go.app = function() {
    var vumigo = require('vumigo_v02');
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

                        next: function(resp) {
                            return {
                                name: 'states_questions',
                                creator_opts: {
                                    topic_id:resp.value // need the selected topic in here
                                }
                            };
                        }
                    });
                });
        });

        self.states.add('states_questions', function(name, opts) {
            return go.utils.get_snappy_questions(self.im, self.im.config.snappy.default_faq, opts.topic_id)
                .then(function(response) {
                    if (typeof response.data.error  !== 'undefined') {
                        // TODO Throw proper error
                        return error;
                    } else {
                        return response.data.map(function(d) {
                            return new Choice(d.id, d.question);
                        });
                    }
                })
                .then(function(choices) {

                    return new BookletState(name, {
                        pages: choices.length,
                        page_text: function(n) {return choices[n].label;},
                        buttons: {"1": -1, "2": +1, "3": "exit"},
                        footer_text:$([
                            "1. Prev",
                            "2. Next",
                            "3. Exit"
                        ].join("\n")),
                        question: $('Please choose a question:'),
                        choices: choices,

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
