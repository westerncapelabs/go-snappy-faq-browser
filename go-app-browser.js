var go = {};
go;

var _ = require('lodash');
var vumigo = require('vumigo_v02');
var JsonApi = vumigo.http.api.JsonApi;
var Choice = vumigo.states.Choice;

go.utils = {
    // Shared utils lib

    get_today: function(config) {
        var today;
        if (config.testing_today) {
            today = new Date(config.testing_today);
        } else {
            today = new Date();
        }
        return today;
    },

    check_valid_number: function(input){
        // an attempt to solve the insanity of JavaScript numbers
        var numbers_only = new RegExp('^\\d+$');
        if (input !== '' && numbers_only.test(input) && !Number.isNaN(Number(input))){
            return true;
        } else {
            return false;
        }
    },

    check_number_in_range: function(input, start, end){
        return go.utils.check_valid_number(input) && (parseInt(input, 10) >= start) && (parseInt(input, 10) <= end);
    },

    is_true: function(bool) {
        //If is is not undefined and boolean is true
        return (!_.isUndefined(bool) && (bool==='true' || bool===true));
    },

    incr_user_extra: function(data_to_increment, amount_to_increment) {
        if (_.isUndefined(data_to_increment)) {
            new_data_amount = 1;
        } else {
            new_data_amount = parseInt(data_to_increment, 10) + amount_to_increment;
        }
        return new_data_amount.toString();
    },

    incr_kv: function(im, name) {
        return im.api_request('kv.incr', {key: name, amount: 1})
            .then(function(result){
                return result.value;
            });
    },

    decr_kv: function(im, name) {
        return im.api_request('kv.incr', {key: name, amount: -1})
            .then(function(result){
                return result.value;
            });
    },

    set_kv: function(im, name, value) {
        return im.api_request('kv.set',  {key: name, value: value})
            .then(function(result){
                return result.value;
            });
    },

    get_kv: function(im, name, default_value) {
        // returns the default if null/undefined
        return im.api_request('kv.get',  {key: name})
            .then(function(result){
                if(result.value === null) return default_value;
                return result.value;
            });
    },

    get_snappy_faqs: function (im) {
        var http = new JsonApi(im, {
            auth: {
                username: im.config.snappy.username,
                password: 'x'
            }
        });
        return http.get(im.config.snappy.endpoint + 'account/'+im.config.snappy.account_id+'/faqs', {
            data: JSON.stringify(),
            headers: {
                'Content-Type': ['application/json']
            },
            ssl_method: "SSLv3"
        });
    },

    get_snappy_topics: function (im, faq_id) {
        var http = new JsonApi(im, {
          auth: {
            username: im.config.snappy.username,
            password: 'x'
          }
        });
        return http.get(im.config.snappy.endpoint + 'account/'+im.config.snappy.account_id+'/faqs/'+faq_id+'/topics', {
          data: JSON.stringify(),
          headers: {
            'Content-Type': ['application/json']
          },
          ssl_method: "SSLv3"
        });
    },

    get_snappy_topic_content: function(im, faq_id, topic_id) {
        var http = new JsonApi(im, {
            auth: {
                username: im.config.snappy.username,
                password: 'x'
            }
        });
        var snappy_topic_content_url = im.config.snappy.endpoint + 'account/' +
                im.config.snappy.account_id + '/faqs/' + faq_id + '/topics/' +
                topic_id + '/questions';

        return http.get(snappy_topic_content_url, {
            data: JSON.stringify(),
            headers: {
                'Content-Type': ['application/json']
            },
            ssl_method: "SSLv3"
        });
    },

    search_faqs: function(im, query, user_lang) {
        var faq_lang = user_lang || 'en';  // default to english
        var http = new JsonApi(im, {
            auth: {
                username: im.config.snappy.username,
                password: 'x'
            }
        });
        var faq_search_url = im.config.snappy.endpoint + 'account/' +
                        im.config.snappy.account_id + '/faqs/search';

        return http
            .get(faq_search_url, {
                headers: {
                    'Content-Type': ['application/json']
                },
                ssl_method: "SSLv3",
                params: {
                    "query": query,
                    "page": 1
                }
            })
            .then(function(result) {
                var qna = {};
                result.data.forEach(function(response) {
                    if (response.question.substr(0,4) === ('['+faq_lang+']')) {
                        qna[response.question.substr(4)] = response.answer;
                    } else if ((response.question.substr(0,1) !== '[') && (faq_lang === 'en')) {
                        qna[response.question] = response.answer;
                    }
                });
                return qna;
            });
    },

    make_search_choices: function(faq_response, $) {
        var choices = [new Choice('restart', $('Restart'))];
        Object.keys(faq_response).forEach(function(question) {
            choices.push(new Choice(question, $(question)));
        });
        return choices;
    }

};


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
                        .search_faqs(self.im, query, self.im.user.lang)
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
                exit: $('Exit'),
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


go.init = function() {
    var vumigo = require('vumigo_v02');
    var InteractionMachine = vumigo.InteractionMachine;
    var GoFAQBrowser = go.app.GoFAQBrowser;


    return {
        im: new InteractionMachine(api, new GoFAQBrowser())
    };
}();
