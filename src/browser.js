// george notes:
// default_faq naming is non-intuitive
// why use opts and not just save data against user? overhead?

go.app = function() {
    var vumigo = require('vumigo_v02');
    var _ = require('lodash');
    var App = vumigo.App;
    var Choice = vumigo.states.Choice;
    var ChoiceState = vumigo.states.ChoiceState;
    var EndState = vumigo.states.EndState;
    var BookletState = vumigo.states.BookletState;

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

        // Start
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
                    return new ChoiceState(name, {
                        question: $('Welcome to FAQ Browser. Choose topic:'),
                        choices: choices,
                        next: 'states_questions'
                    });
                });
        });

        // Show questions in topic x
        self.states.add('states_questions', function(name, opts) {
            return go.utils.get_snappy_questions(self.im, 
                        self.im.config.snappy.default_faq, self.im.user.answers.states_start)
                .then(function(response) {
                    if (typeof response.data.error  !== 'undefined') {
                        // TODO Throw proper error
                        return error;
                    } else {
                        var choices = response.data.map(function(d) {
                            return new Choice(d.id, d.question);
                        });
                        // askmike: should we use something like the code below maybe?
                        // var answers = response.data.map(function(d) {
                        //     return new Choice(d.id, d.answer);
                        // });
                        return {
                            choices: choices,
                            response: response
                            // answers: answers
                        };
                    }
                })
                .then(function(result) {
                    return new ChoiceState(name, {
                        metadata: self.resp,
                        question: $('Please choose a question:'),
                        choices: result.choices,
                        next: function(){
                            return {
                                name: 'states_answers',
                                creator_opts: result.response
                            };
                        }

                    });
                });
        });

        // Show answer in question x
        self.states.add('states_answers', function(name, opts) {
            // TODO: simplify this state

            return go.utils.get_snappy_answers(self.im, 
                        self.im.config.snappy.default_faq, 
                            self.im.user.answers.states_start)
                .then(function(response) {
                    if (typeof response.data.error  !== 'undefined') {
                        // TODO Throw proper error
                        return error;
                    } else {
                        // TODO: move to get_snappy_answers
                        // TODO: slice answer up
                        id = self.im.user.answers.states_questions;
                        index = _.findIndex(opts.data, { 'id': id });
                        answer = opts.data[index].answer;
                        console.log(answer);
                        return [answer];
                    }
                })
                .then(function(pages) {

                    return new BookletState(name, {
                        pages: pages.length,
                        page_text: function(n) {return pages[n];},
                        buttons: {"1": -1, "2": +1, "3": "exit"},
                        footer_text:$([
                            "1. Prev",
                            "2. Next",
                            "3. Exit"
                        ].join("\n")),
                        next: 'states_end'
                    });
                });
        });

        self.states.add('states_end', function(name) {
            return new EndState(name, {
                text: $('Thank you. That topic is not ready yet. Dial again soon!'),

                next: 'states_start'
            });
        });

    });

    return {
        GoFAQBrowser: GoFAQBrowser
    };
}();

