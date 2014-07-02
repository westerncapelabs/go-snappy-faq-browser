var go = {};
go;

go.paginated_extension = function() {
	var vumigo = require('vumigo_v02');
	var _ = require('lodash');
	var Choice = vumigo.states.Choice;
	var PaginatedChoiceState = vumigo.states.PaginatedChoiceState;

	var MenuChoiceState = PaginatedChoiceState.extend(function(self, name, opts) {
		PaginatedChoiceState.call(self, name, opts);
		
		var current_choices = self.current_choices;

		self.current_choices = function() {
			var choices = current_choices();
			var index = _.findIndex(choices, function(choice) {
				return choice.value === '__more__' || choice.value === '__back__';
			});

			choices.splice(index, 0, new Choice('states:start', 'Menu'));

			return choices;
		};
	});

	return {
		MenuChoiceState: MenuChoiceState
	};
}();
var _ = require('lodash');
var vumigo = require('vumigo_v02');
var HttpApi = vumigo.http.api.HttpApi;
// var JsonApi = api.JsonApi;

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

    get_snappy_topics: function (acc_id, faq_id, im) {
        var http = new HttpApi(im, {
          auth: {
            username: im.config.snappy.username,
            password: 'x'
          }
        });
        return http.get(im.config.snappy.endpoint + 'account/'+acc_id+'/faqs/'+faq_id+'/topics', {
          data: JSON.stringify(),
          headers: {
            'Content-Type': ['application/json']
          },
          ssl_method: "SSLv3"
        });
    },

    get_snappy_questions: function(json_doc, im, acc_id, faq_id, topic_id) {

        acc_id = typeof acc_id !== 'undefined' ? acc_id : 1;
        faq_id = typeof faq_id !== 'undefined' ? faq_id : 1;

        var http = new HttpApi(im, {
          auth: {
            username: im.config.snappy.username,
            password: 'x'
          },
          headers: {
            'Content-Type': ['application/json']
          }
        });
        return http.get(im.config.snappy.endpoint + 'account/'+acc_id+'/faqs/'+faq_id+'/topics/'+topic_id+'/questions', {
          ssl_method: "SSLv3",
          data: JSON.stringify(json_doc)
        });

    },

    get_snappy_answer: function() {

    },

};

go.app = function() {
    var vumigo = require('vumigo_v02');
    var App = vumigo.App;
    var Choice = vumigo.states.Choice;
    var ChoiceState = vumigo.states.ChoiceState;
    var EndState = vumigo.states.EndState;
    // var BookletState = vumigo.states.BookletState;

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
