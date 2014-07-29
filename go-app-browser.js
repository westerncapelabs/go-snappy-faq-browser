var go = {};
go;

var _ = require('lodash');
var vumigo = require('vumigo_v02');
var JsonApi = vumigo.http.api.JsonApi;

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
        return go.utils.check_valid_number(input) && (parseInt(input, 0) >= start) && (parseInt(input, 10) <= end);
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
        return http.get(im.config.snappy.endpoint + 'account/'+im.config.snappy.account_id+'/faqs/'+faq_id+'/topics/'+topic_id+'/questions', {
          data: JSON.stringify(),
          headers: {
            'Content-Type': ['application/json']
          },
          ssl_method: "SSLv3"
        });
    },

};

// george notes:
// default_faq naming is non-intuitive
// why use opts and not just save data against user? overhead?

go.app = function() {
    var vumigo = require('vumigo_v02');
    var _ = require('lodash');
    var App = vumigo.App;
    var Choice = vumigo.states.Choice;
    var EndState = vumigo.states.EndState;
    var BookletState = vumigo.states.BookletState;
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
                            options_per_page: 3,
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

        // Show answer to selected question
        self.states.add('states_answers', function(name, opts) {
            var id = self.im.user.answers.states_questions;
            var index = _.findIndex(opts.data, { 'id': id });
            var footer_text = [
                    "1. Prev",
                    "2. Next",
                    "0. Send to me by SMS"
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


go.init = function() {
    var vumigo = require('vumigo_v02');
    var InteractionMachine = vumigo.InteractionMachine;
    var GoFAQBrowser = go.app.GoFAQBrowser;


    return {
        im: new InteractionMachine(api, new GoFAQBrowser())
    };
}();
