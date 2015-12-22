module.exports = function (gulp, $, $env) {
    var $defaults = require("../lib/defaults")(gulp, $, $env),
        $helpers = require("../lib/helpers")(gulp, $, $env),
        $transform = require("../lib/transformers")(gulp, $, $env);

    // Delete JS files
    gulp.task('js:clean', ['start'], function (done) {
        $env.apply_to_config(function (configuration, incrementUpdates, incrementFinished, ifDone) {
            incrementUpdates();

            $env.delete($helpers.config.getDeleteGlob(configuration)).then(function () {
                incrementFinished();
                ifDone();
            });
        }, done, false, 'js', false, $helpers.config.canDelete, $defaults.js);
    });

    // Process JS files, including uglify and coffee script
    gulp.task('js', ['start', 'js:clean'], function (done) {
        return $env.apply_to_config_and_stream(function (configuration, addToStream) {
            configuration = $helpers.config.add_filename(configuration, 'js');

            if (configuration.browserify) {
                addToStream(
                    $transform.js(configuration)()
                        .pipe(gulp.dest(configuration.dest))
                    //.pipe($env.server.reload({stream: true}))
                );
            }
            else {
                addToStream(
                    gulp.src(configuration.src)
                        .pipe($transform.js(configuration)())
                        .pipe(gulp.dest(configuration.dest))
                    //.pipe($env.server.reload({stream: true}))
                );
            }
        }, done, 'js', false, false, $defaults.js);
    });

    // Lint JS files
    gulp.task('js:lint', ['start'], function (done) {
        return $env.apply_to_config_and_stream(function (configuration, addToStream) {
            configuration = $helpers.config.add_filename(configuration, 'js');

            addToStream(
                gulp.src(configuration.lint)
                    .pipe($transform.js_lint(configuration)())
            );
        }, done, 'js', false, function (configuration) {
            return configuration.hasOwnProperty('lint');
        }, $defaults.js);
    });
};