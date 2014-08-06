
go.app = function() {
    var vumigo = require('vumigo_v02');
    var _ = require('lodash');
    var App = vumigo.App;
    var Choice = vumigo.states.Choice;
    var EndState = vumigo.states.EndState;
    var PaginatedState = vumigo.states.PaginatedState;
    var PaginatedChoiceState = vumigo.states.PaginatedChoiceState;

    var GoFAQBrowser = App.extend(function(self) {
        App.call(self, 'states_start');
        var $ = self.$;

        self.init = function() {
            return self.im.contacts
                .for_user()
                .then(function(user_contact) {
                   self.contact = user_contact;
                });
        };

        // Start - select topic
        self.states.add('states_start', function(name) {
            return go.utils.get_snappy_topics(self.im, self.im.config.snappy.default_faq)
                .then(function(response) {
                    if (typeof response.data.error  !== 'undefined') {
                        // TODO Throw proper error
                        return error;
                    } else {
                        return response.data.map(function(d) {
                            return new Choice(d.id, d.topic);
                        });
                    }
                })
                .then(function(choices) {
                    return new PaginatedChoiceState(name, {
                        question: $('Welcome to FAQ Browser. Choose topic:'),
                        choices: choices,
                        options_per_page: 8,
                        next: 'states_questions'
                    });
                });
        });

        // Show questions in selected topic
        self.states.add('states_questions', function(name, opts) {
            return go.utils.get_snappy_topic_content(self.im, 
                        self.im.config.snappy.default_faq, self.im.user.answers.states_start)
                .then(function(response) {
                    if (typeof response.data.error  !== 'undefined') {
                        // TODO Throw proper error
                        return error;
                    } else {
                        var choices = response.data.map(function(d) {
                            return new Choice(d.id, d.question);
                        });

                        return new PaginatedChoiceState(name, {
                            question: $('Please choose a question:'),
                            choices: choices,
                            // TODO calculate options_per_page once content length is known
                            options_per_page: 2,
                            next: function() {
                                return {
                                    name: 'states_answers',
                                    creator_opts: {
                                        response: response
                                    }
                                };
                            }
                        });
                    }
                });
        });

        // Show answer to selected question
        self.states.add('states_answers', function(name, opts) {
            var id = self.im.user.answers.states_questions;
            var index = _.findIndex(opts.response.data, { 'id': id });
            var answer = opts.response.data[index].answer.trim();

            return new PaginatedState(name, {
                text: answer,
                exit: "Send to me by SMS", 
                // wrap in translation? make sure this is going into POT files
                // buttons: {"1": -1, "2": +1, "0": "exit"}, 
                // get buttons option again? currently auto-assigns numbers
                next: function() {
                    return {
                        name: 'states_end',
                        creator_opts: {
                            answer: answer
                        }
                    };
                }
            });
        });

        // End
        self.states.add('states_end', function(name, opts) {
            return new EndState(name, {
                text: $('Thank you. Your SMS will be delivered shortly.'),

                next: 'states_start',

                events: {
                    'state:enter': function() {
                        return self.im.outbound.send_to_user({
                            endpoint: 'sms',
                            content: opts.answer
                        });
                    }
                }
            });
        });

    });

    return {
        GoFAQBrowser: GoFAQBrowser
    };
}();

