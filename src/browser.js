
go.app = function() {
    var vumigo = require('vumigo_v02');
    var _ = require('lodash');
    var App = vumigo.App;
    var Choice = vumigo.states.Choice;
    var EndState = vumigo.states.EndState;
    var PaginatedState = vumigo.states.PaginatedState;
    var PaginatedChoiceState = vumigo.states.PaginatedChoiceState;
    var FreeText = vumigo.states.FreeText;

    var GoFAQBrowser = App.extend(function(self) {
        App.call(self, 'states_start');
        var $ = self.$;

        self.init = function() {
            self.env = self.im.config.env;
            return self.im.contacts
                .for_user()
                .then(function(user_contact) {
                   self.contact = user_contact;
                });
        };

        // Start - select topic
        self.states.add('states_start', function(name) {
          if(self.im.config.snappy.default_faq) {
            return self.states.create('states_topics', {
                faq_id: self.im.config.snappy.default_faq
            });
          } else {
            return self.states.create('states_faqs');
          }
        });

        self.states.add('states_faqs', function (name, opts) {
            return go.utils.get_snappy_faqs(self.im)
                .then(function (response) {
                    if(typeof response.data.error !== 'undefined') {
                        return error;
                    } else {
                        return _.sortBy(response.data, function (d) {
                                return parseInt(d.order, 10);
                            })
                            .map(function (d) {
                                return new Choice(d.id, d.title);
                            });
                    }
                })
                .then(function (choices) {
                    return new PaginatedChoiceState(name, {
                        question: $('Welcome to FAQ Browser. Choose FAQ:'),
                        choices: choices,
                        options_per_page: 8,
                        next: function (choice) {
                            return {
                                name: 'states_topics',
                                creator_opts: {
                                    faq_id: choice.value
                                }
                            };
                        }
                    });
                });
        });

        self.states.add('states_topics', function (name, opts) {
            return go.utils.get_snappy_topics(self.im, opts.faq_id)
                .then(function(response) {
                    if (typeof response.data.error  !== 'undefined') {
                        // TODO Throw proper error
                        return error;
                    } else {
                        return _.sortBy(response.data, function (d) {
                                return parseInt(d.order, 10);
                            })
                            .map(function(d) {
                                return new Choice(d.id, d.topic);
                            });
                    }
                })
                .then(function(choices) {
                    choices.unshift(new Choice('search', 'Search FAQs'));
                    return new PaginatedChoiceState(name, {
                        question: $('Welcome to FAQ Browser. Choose topic:'),
                        choices: choices,
                        options_per_page: 8,
                        next: function(choice) {
                            var ch = choice.value;
                            return self.im.metrics.fire
                                .inc([
                                        self.env,
                                        'faq_view_topic',
                                        choice.value
                                    ].join('.'), 1)
                                .then(function(choice) {
                                    if (ch === 'search') {
                                        return {
                                            name: 'states_search_query',
                                            creator_opts: {
                                                faq_id: opts.faq_id
                                            }
                                        };
                                    } else {
                                        return {
                                            name: 'states_questions',
                                            creator_opts: {
                                                faq_id: opts.faq_id
                                            }
                                        };
                                    }
                                });
                        }
                    });
                });
        });

        // Ask what user wants to search for
        self.states.add('states_search_query', function(name, opts) {
            return new FreeText(name, {
                question: $('What do you want to know about?'),
                next: function(query) {
                    return go.utils
                        .search_faqs(self.im, query)
                        .then(function(faq_response) {
                            return {
                                name: 'states_search_responses',
                                creator_opts: {
                                    faq_response: faq_response,
                                    faq_id: opts.faq_id
                                }
                            };
                        });
                }
            });
        });

        // Show FAQ search results
        self.states.add('states_search_responses', function(name, opts) {
            return new PaginatedChoiceState(name, {
                question: $("Select:"),
                characters_per_page: 160,
                back: $('Back'),
                more: $('Next'),
                options_per_page: null,
                choices: go.utils.make_search_choices(opts.faq_response, $),
                next: function(choice) {
                    if (choice.value === 'restart') {
                        return {
                            name: 'states_topics',
                            creator_opts: {
                                faq_id: opts.faq_id
                            }
                        };
                    } else {
                    return {
                            name: 'states_search_answers',
                            creator_opts: {
                                faq_response: opts.faq_response,
                                faq_id: opts.faq_id,
                                answer: opts.faq_response[choice.value],
                            }
                        };
                    }
                }
            });
        });

        // Show selected FAQ answer
        self.states.add('states_search_answers', function(name, opts) {
            return new PaginatedState(name, {
                text: opts.answer,
                more: $('More'),
                back: $('Back'),
                exit: $('Show another'),
                next: function() {
                    return {
                        name: 'states_search_responses',
                        creator_opts: {
                            faq_response: opts.faq_response,
                            faq_id: opts.faq_id
                        }
                    };
                }
            });
        });

        // Show questions in selected topic
        self.states.add('states_questions', function(name, opts) {
            return go.utils.get_snappy_topic_content(self.im,
                        opts.faq_id, self.im.user.answers.states_topics)
                .then(function(response) {
                    if (typeof response.data.error  !== 'undefined') {
                        // TODO Throw proper error
                        return error;
                    } else {
                        var choices = _.sortBy(response.data, function (d) {
                                return parseInt(d.pivot.order, 10);
                            })
                            .map(function(d) {
                                return new Choice(d.id, d.question);
                            });

                        return new PaginatedChoiceState(name, {
                            question: $('Please choose a question:'),
                            choices: choices,
                            options_per_page: null,
                            next: function(choice) {
                                var question_id = choice.value;
                                var index = _.findIndex(response.data, { 'id': question_id});
                                var answer = response.data[index].answer.trim();
                                return self.im.metrics.fire
                                    .inc([self.env, 'faq_view_question'].join('.'), 1)
                                    .then(function() {
                                        return {
                                            name: 'states_answers',
                                            creator_opts: {
                                                answer: answer
                                            }
                                        };
                                    });
                            }
                        });
                    }
                });
        });

        // Show answer to selected question
        self.states.add('states_answers', function(name, opts) {
            return new PaginatedState(name, {
                text: opts.answer,
                more: $('More'),
                back: $('Back'),
                exit: $('Send to me by SMS'),
                next: function() {
                    return {
                        name: 'states_send_sms',
                        creator_opts: {
                            answer: opts.answer
                        }
                    };
                }
            });
        });

        self.states.add('states_send_sms', function (name, opts) {
            return self.im
                .outbound.send_to_user({
                    endpoint: 'sms',
                    content: opts.answer
                })
                .then(function() {
                    return self.im.metrics.fire.inc([self.env, 'faq_sent_via_sms'].join('.'), 1);
                })
                .then(function () {
                    return self.states.create('states_end');
                });
        });

        // End
        self.states.add('states_end', function(name, opts) {
            return new EndState(name, {
                text: $('Thank you. Your SMS will be delivered shortly.'),
                next: 'states_start'
            });
        });

    });

    return {
        GoFAQBrowser: GoFAQBrowser
    };
}();

