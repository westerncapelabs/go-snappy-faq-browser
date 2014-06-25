go.app = function() {
    var vumigo = require('vumigo_v02');
    var App = vumigo.App;
    var Choice = vumigo.states.Choice;
    var ChoiceState = vumigo.states.ChoiceState;
    var EndState = vumigo.states.EndState;

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
            return new ChoiceState(name, {
                question: $('Welcome to FAQ Browser. Choose topic:'),

                choices: [
                    new Choice('topic_1', $('Topic 1')),
                    new Choice('topic_2', $('Topic 2')),
                    new Choice('topic_3', $('Topic 3')),
                    new Choice('topic_4', $('Topic 4')),
                    new Choice('topic_5', $('Topic 5'))
                ],

                next: 'states_end'

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

