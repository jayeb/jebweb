var _ = require('lodash');

module.exports = function(grunt) {
  var env = (grunt.option('env') === 'prod' ? 'prod' : 'dev'),
      paths = {
          tmp: '.tmp',
          srv: '.' + env + '_srv',
          working: 'app'
        },
      pipe = require('pipe-grunt')(grunt, {tempCwd: paths.tmp}),
      bundleHunter = require('bundlehunter'),
      bowerDeps = require('bowerdeps');

  require('time-grunt')(grunt);
  require('jit-grunt')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    name: '<%= pkg.name %>',
    default_filename: '<%= pkg.name.toLowerCase().replace(/[^A-Za-z0-9]/g, "_") %>',
    paths: paths,

    // Javascript
    jshint: {
        src: '<%= paths.working %>/scripts/**/*.js',
        options: {
            jshintrc: '.jshintrc',
            reporter: require('reporter-plus/jshint')
          }
      },
    jscs: {
        src: '<%= paths.working %>/scripts/**/*.js',
        options: {
            config: ".jscsrc",
            reporter: require('reporter-plus/jscs').path
          }
      },
    uglify: {
        options: {
            sourceMap: true
          }
      },

    // CSS
    autoprefixer: {
        options: {
            browsers: ['last 2 versions']
          }
      },
    cssmin: {
        options: {
            sourceMap: true
          }
      },

    // SVG
    svgstore: {
        options: {
            prefix : 'icon-',
            svg: {
                style: 'position:absolute;width:0;height:0;visibility:hidden;',
                xmlns: 'http://www.w3.org/2000/svg'
              }
          }
      },

    // HTML
    insertbower: {
        options: {
            types: {
                js: {
                    includeBase: 'scripts/libs'
                  },
                css: {
                    includeBase: 'styles/libs'
                  }
              }
          }
      },
    processhtml: {
        options: {
            commentMarker: 'process',
            includeBase: '<%= paths.srv %>',
            environment: env,
            strip: true
          }
      },

    // Nuclear option
    clean: ['<%= paths.srv %>'],

    // Server and loading tasks
    express: {
        options: {
            port: env === 'dev' ? 9010 : 9011,
            hostname: '0.0.0.0',
            bases: env === 'dev' ? ['_dev'] : ['_prod']
          }
      },
    chromeload: {
        server: {
            reload_pattern: 'https?:\/\/<%= express.options.hostname %>:<%= express.options.port %>',
            new_url: 'http://<%= express.options.hostname %>:<%= express.options.port %>'
          }
      },
    watch: {
        js: {
            files: [
                '<%= paths.working %>/scripts/**/*.js',
              ],
            tasks: [
                'build:js',
                'chromeload:server'
              ]
          },
        css: {
            files: [
                '<%= paths.working %>/styles/**/*.css',
              ],
            tasks: [
                'build:css',
                'chromeload:server'
              ]
          },
        images: {
            files: [
                '<%= paths.working %>/images/**/*.{jpg,jpeg,gif,png}',
              ],
            tasks: [
                'build:images',
                'chromeload:server'
              ]
          },
        svg: {
            files: [
                '<%= paths.working %>/svg/**/*.svg',
              ],
            tasks: [
                'build:svg',
                'chromeload:server'
              ]
          },
        html: {
            files: [
                '<%= paths.working %>/**/*.html',
              ],
            tasks: [
                'build:html',
                'chromeload:server'
              ]
          },
        libs: {
            files: [
                'bower.json',
              ],
            tasks: [
                'build:libs',
                'build:html',
                'chromeload:server'
              ]
          },
        misc: {
            files: [
                '**/**',
                '!scripts/**/*.js',
                '!styles/**/*.css',
                '!images/**/*.{jpg,jpeg,gif,png}',
                '!svg/**/*.svg',
                '!**/*.html'
              ],
            tasks: [
                'build:misc',
                'chromeload:server'
              ]
          }
      }
  });

  /* --- Build tasks for specific filetypes ---*/

  grunt.registerTask('build:js', function() {
    var tasks,
        bundles,
        files;

    tasks = [
      {
          task: 'jshint',
          files: false
        },
      {
          task: 'jscs',
          files: false
        }
    ];

    if (env === 'prod') {
      bundles = bundleHunter(paths.working + '/*.html', {
        types: ['js']
      });

      tasks.push(
        {
            task: 'uglify',
            config: {
                sourceMapRoot: paths.working + '/scripts'
              },
            files: _.map(bundles.js, function(bundle) {
                return {
                  src: bundle.files,
                  dest: bundle.name + '.min.js'
                };
              })
          }
      );
    }

    files = {
      expand: true,
      cwd: paths.working + '/scripts',
      src: '**/*.js',
      dest: paths.srv + '/scripts'
    };

    pipe(tasks, files);
  });

  grunt.registerTask('build:css', function() {
    var tasks,
        bundles,
        files;

    tasks = [
      {
          task: 'stylus',
          files: {
              ext: '.css'
            }
        },
      'autoprefixer'
    ];

    if (env === 'prod') {
      bundles = bundleHunter(paths.working + '/*.html', {
        types: ['css']
      });

      tasks.push(
        {
            task: 'cssmin',
            files: _.map(bundles.css, function(bundle) {
                return {
                  src: bundle.files,
                  dest: bundle.name + '.min.css'
                };
              })
          }
      );
    }

    files = {
      expand: true,
      cwd: paths.working + '/styles',
      src: '**/*.styl',
      dest: paths.srv + '/styles'
    };

    pipe(tasks, files);
  });

  grunt.registerTask('build:images', function() {
    var tasks = [],
        files;

    if (env === 'prod') {
      tasks.push('imagemin');
    }

    files = {
      expand: true,
      cwd: paths.working + '/images',
      src: '**/*.{jpg,jpeg,gif,png}',
      dest: paths.srv + '/images'
    };

    pipe(tasks, files);
  });

  grunt.registerTask('build:svg', function() {
    var tasks = [],
        files;

    tasks.push(
      'svgmin',
      {
          task: 'svgstore',
          files: {
              dest: 'icons.svg'
            }
        }
    );

    files = {
      expand: true,
      cwd: paths.working + '/svg',
      src: '**/*.svg',
      dest: paths.srv + '/svg'
    };

    pipe(tasks, files);
  });

  grunt.registerTask('build:libs', function() {
    var libs,
        jsTasks = [],
        cssTasks = [],
        jsFiles,
        cssFiles;

    libs = bowerDeps({
      types: ['js', 'css']
    });

    if (env === 'prod') {
      jsTasks.push({
        task: 'uglify',
        files: 'libs.min.js'
      });

      cssTasks.push({
        task: 'cssmin',
        files: 'libs.min.css'
      });

      jsFiles = {
        expand: true,
        flatten: true,
        src: _.chain(libs.js).pluck('files').flatten().value(),
        dest: paths.srv + '/scripts'
      };

      cssFiles = {
        expand: true,
        flatten: true,
        src: _.chain(libs.css).pluck('files').flatten().value(),
        dest: paths.srv + '/styles'
      };
    } else {
      jsFiles = {
        expand: true,
        flatten: true,
        src: _.chain(libs.js).pluck('files').flatten().value(),
        dest: paths.srv + '/scripts/libs'
      };

      cssFiles = {
        expand: true,
        flatten: true,
        src: _.chain(libs.css).pluck('files').flatten().value(),
        dest: paths.srv + '/styles/libs'
      };
    }

    pipe(jsTasks, jsFiles);
    pipe(cssTasks, cssFiles);
  });

  grunt.registerTask('build:partials', function() {
    var tasks = [],
        files;

    tasks.push({
      task: 'processhtml'
    });

    files = {
      expand: true,
      cwd: paths.working + '/partials',
      src: '**/*.html',
      dest: paths.srv + '/partials'
    };

    pipe(tasks, files);
  });

  grunt.registerTask('build:templates', function() {
    var tasks = [],
        files;

    tasks.push({
      task: 'processhtml'
    });

    files = {
      expand: true,
      cwd: paths.working + '/templates',
      src: '**/*.html',
      dest: paths.srv + '/templates'
    };

    pipe(tasks, files);
  });

  grunt.registerTask('build:html', function() {
    var tasks = [],
        files;

    tasks.push('processhtml');
    tasks.push('insertbower');

    files = {
      expand: true,
      cwd: paths.working,
      src: '*.html',
      dest: paths.srv
    };

    pipe(tasks, files);
  });

  grunt.registerTask('build:misc', function() {
    var files = {
      expand: true,
      cwd: paths.working + '/partials',
      src: [
          '**/**',
          '!scripts/**/*.js',
          '!styles/**/*.css',
          '!images/**/*.{jpg,jpeg,gif,png}',
          '!svg/**/*.svg',
          '!**/*.html'
        ],
      dest: paths.srv + '/partials'
    };

    pipe([], files);
  });

  grunt.registerTask('build:all', [
    'clean',
    'build:js',
    'build:css',
    'build:images',
    'build:svg',
    'build:libs',
    'build:templates',
    'build:partials',
    'build:html',
    'build:misc'
  ]);

  grunt.registerTask('build', ['build:all']);

  grunt.registerTask('serve', [
    'build:all',
    'express',
    'load',
    'watch'
  ]);

  grunt.registerTask('default', ['serve']);
};
