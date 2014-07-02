var go = {};
go;

var _ = require('lodash');

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

};

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


go.init = function() {
    var vumigo = require('vumigo_v02');
    var InteractionMachine = vumigo.InteractionMachine;
    var GoFAQBrowser = go.app.GoFAQBrowser;


    return {
        im: new InteractionMachine(api, new GoFAQBrowser())
    };
}();
