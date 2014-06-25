module.exports = function() {
    return [
    {
        'request': {
            'method': 'GET',
            'headers': {
                'Authorization': ['Basic ' + new Buffer('test:test').toString('base64')],
                'Content-Type': ['application/json']
            },
            'url': 'http://test/v2/json/'
        },
        'response': {
            "code": 200,
            "data": {
                "success": "true"
            }
        }
    }];
};
