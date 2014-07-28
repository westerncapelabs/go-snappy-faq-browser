var vumigo = require('vumigo_v02');
var fixtures = require('./fixtures');
var AppTester = vumigo.AppTester;
var assert = require('assert');
var _ = require('lodash');

describe("app", function() {
    describe("for browsing FAQ", function() {
        var app;
        var tester;

        beforeEach(function() {
            app = new go.app.GoFAQBrowser();

            tester = new AppTester(app);

            tester
                .setup.char_limit(255)
                .setup.config.app({
                    name: 'snappy_browser_test',
                    env: 'test',
                    metric_store: 'test_metric_store',
                    testing: 'true',
                    testing_today: 'April 4, 2014 07:07:07',
                    endpoints: {
                        "sms": {"delivery_class": "sms"}
                    },
                    snappy: {
                        "endpoint": "https://app.besnappy.com/api/v1/",
                        "username": "980d2423-292b-4c34-be81-c74784b9e99a",
                        "account_id": "1",
                        "default_faq": "1"
                    }
                })
                .setup(function(api) {
                    fixtures().forEach(api.http.fixtures.add);
                });
        });

        describe("when the user starts a session", function() {
            it("should welcome and ask to choose topic", function() {
                return tester
                    .start()
                    .check.interaction({
                        state: 'states_start',
                        reply: [
                            'Welcome to FAQ Browser. Choose topic:',
                            '1. Coffee',
                            '2. delivery',
                            '3. Payment',
                            '4. PowerBar',
                            '5. Refund',
                            '6. Subscriptions'
                        ].join('\n')
                    })
                    .run();
            });
        });

        describe("when the user chooses topic 52", function() {
            it("should list first page of questions in topic 52", function() {
                return tester
                    .setup.user.state('states_start')
                    .input('1')
                    .check.interaction({
                        state: 'states_questions',
                        reply: ('Please choose a question:\n1. Can I order more than ' +
                                'one box at a time?\n2. What happens if I fall in love ' +
                                'with one particular coffee?\n3. What happens if the ' +
                                'FAQ answer is really long?\n4. More')
                    })
                    .run();
            });
        });

        describe("when the user chooses topic 52 and then 4. More", function() {
            it("should list second page of questions in topic 52", function() {
                return tester
                    .setup.user.state('states_start')
                    .inputs('1', '4')
                    .check.interaction({
                        state: 'states_questions',
                        reply: ('Please choose a question:\n1. What happens if I realise ' +
                                'the amount of coffee I\'ve ordered doesn\'t suit me?' +
                                '\n2. Back')
                    })
                    .run();
            });
        });

        describe("When the user chooses question 635", function() {
            it("should show answer to question 635", function() {
                return tester
                    .setup.user.state('states_questions')
                    .setup.user.answers({'states_start': '52'})
                    .input('1')
                    .check.interaction({
                        state: 'states_answers',
                        reply: ('If the default box of 2 x 250g is not enough for ' +
                            'your needs, you can increase the quantity up to 7 bags ' + 
                            '(or consider the Bulk subscription, starting at 2kgs).' +
                            '\n1. Prev\n2. Next\n3. Exit')
                    })
                    .run();
            });
        });

        // test for long faq answer splitting
        describe("When the user chooses question 999", function() {
            it("should show the first part of the answer of 999", function() {
                return tester
                    .setup.user.state('states_questions')
                    .setup.user.answers({'states_start': '52'})
                    .inputs('3')
                    .check.interaction({
                        state: 'states_answers',
                        reply: ('It will be split into multiple pages on a ' +
                            'bookletstate, showing content on different screens ' +
                            'as the text gets too long. To illustrate this, this ' +
                            'super long response has been faked. This should be ' +
                            'split over at least 2 screens just' +
                            '\n1. Prev\n2. Next\n3. Exit')
                    })
                    .run();
            });
        });

        describe("When the user chooses question 999 and then 2. Next", function() {
            it("should show the second part of the answer to 999", function() {
                return tester
                    .setup.user.state('states_questions')
                    .setup.user.answers({'states_start': '52'})
                    .inputs('3', '2')
                    .check.interaction({
                        state: 'states_answers',
                        reply: ('because we want to test properly. Let\'s see.' +
                            '\n1. Prev\n2. Next\n3. Exit')
                    })
                    .run();
            });
        });

        describe("When the user chooses to Exit", function() {
            it("should thank the user and exit", function() {
                return tester
                    .setup.user.state('states_questions')
                    .setup.user.answers({'states_start': '52'})
                    .inputs('3', '3')
                    .check.interaction({
                        state: 'states_end',
                        reply: ('Thank you. That topic is not ready yet. Dial ' +
                            'again soon!')
                    })
                    .check.reply.ends_session()
                    .run();
            });
        });
    });
});
