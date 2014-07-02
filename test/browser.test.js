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
                        "username": "980d2423-292b-4c34-be81-c74784b9e99a"
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
                            '1. Topic 1',
                            '2. Topic 2',
                            '3. Topic 3',
                            '4. Topic 4',
                            '5. Topic 5'
                        ].join('\n')
                    })
                    .run();
            });
        });

        describe("When the user chooses topic 1", function() {
            it("should thank them and exit", function() {
                return tester
                    .setup.user.state('states_start')
                    .input('1')
                    .check.interaction({
                        state: 'states_end',
                        reply: ('Thank you. That topic is not ready yet. ' +
                                'Dial again soon!')
                    })
                    .check.reply.ends_session()
                    .run();
            });
        });
    });
});
