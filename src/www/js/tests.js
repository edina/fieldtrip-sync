"use strict";
define(['./upload'], function(upload) {
    var run = function() {
        test('Sync: do something.', function() {
            equal(2, 2, 'The return should be 2.');
        });
    };
    return {run: run}
});
