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

                        return new ChoiceState(name, {
                            question: $('Please choose a question:'),
                            choices: choices,
                            next: function() {
                                return {
                                    name: 'states_answers',
                                    creator_opts: response
                                };
                            }
                        });
                    }
                });
        });

        // Show answer in question x
        self.states.add('states_answers', function(name, opts) {
            var id = self.im.user.answers.states_questions;
            var index = _.findIndex(opts.data, { 'id': id });
            var footer_text = [
                    "1. Prev",
                    "2. Next",
                    "3. Exit"
                ].join("\n");
            var num_chars = 255 - footer_text.length; // askmike: what to do with translated footer_text?
            var answer = opts.data[index].answer.trim();
            var answer_split = [];

            while (answer.length > 0 && answer.length > num_chars) {
                answer_max_str = answer.substr(0,num_chars);
                space_index = answer_max_str.lastIndexOf(' ');
                answer_sub = answer.substr(0, space_index);
                answer_split.push(answer_sub);
                answer = answer.slice(space_index+1);
            }
            answer_split.push(answer);

            return new BookletState(name, {
                pages: answer_split.length,
                page_text: function(n) {return answer_split[n];},
                buttons: {"1": -1, "2": +1, "3": "exit"},
                footer_text:$(footer_text),
                next: 'states_end'
            });
        });

        // End
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

