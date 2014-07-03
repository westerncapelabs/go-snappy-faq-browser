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
                .setup.char_limit(160)
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

        // describe("When the user chooses topic 1", function() {
        //     it("should list questions in topic 1", function() {
        //         return tester
        //             .setup.user.state('states_questions')
        //             .input('52')
        //             .check.interaction({
        //                 state: 'states_end',
        //                 reply: ('Please choose a question:')
        //             })
        //             .check.reply.ends_session()
        //             .run();
        //     });
        // });

        describe("When the user chooses topic 1", function() {
            it("should list questions in topic 1", function() {
                return tester
                    .setup.user.state('states_start')
                    .input('1')
                    .check.interaction({
                        state: 'states_questions',
                        reply: ('Can I order more than one box at a time?\n1. Prev\n2. Next\n3. Exit')
                    })
                    .run();
            });
        });
    });
});