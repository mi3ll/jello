module.exports = function (gulp, $, $env) {
    var $defaults = require("../lib/defaults")(gulp, $, $env),
        startPhp = function(options, cb) {
            if(options && (!options.hasOwnProperty('php') || !$env.shell.which('php'))) {
                return;
            }

            var host = options.php !== true && options.php.hasOwnProperty('host') ? options.php.host : $defaults.php.host,
                ini = options.php !== true && options.php.hasOwnProperty('ini') ? ' -c ' + options.php.ini : '',
                dir = options.php !== true && options.php.hasOwnProperty('dir') ? ' -t ' + options.php.dir : '',
                router = options.php !== true && options.php.hasOwnProperty('router') ? ' ' + options.php.router : '';

            $env.shell.exec('php -S ' + host + ini + dir + router, {async: true}, function() {
                if(cb) {
                    cb();
                }
            });
        };

    // Start a browser sync server
    gulp.task('server', ['jekyll'], function (done) {
        var options = $env.project().hasOwnProperty('server') ? $env.project().server : $defaults.server.options;

        startPhp(options);

        $env.server(options, function () {
            done();
        });
    });

    // Start a php server
    gulp.task('server:php', ['jekyll'], function (done) {
        var options = $env.project().hasOwnProperty('server') ? $env.project().server : $defaults.server.options;
        startPhp(options, done);
    });

    // Reload server
    gulp.task('server:reload', function (done) {
        $env.server.reload();
        done();
    });
};