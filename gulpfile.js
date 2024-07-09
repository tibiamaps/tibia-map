'use strict';

const del = require('del');
const gulp = require('gulp');
const autoprefixer = require('gulp-autoprefixer');
const cleanCSS = require('gulp-clean-css');
const concat = require('gulp-concat');
const imagemin = require('gulp-imagemin');
const replace = require('gulp-replace');
const terser = require('gulp-terser');
const server = require('gulp-webserver');

const paths = {
  html: [
    'src/index.html',
    'src/small.html',
    'src/embed.html'
  ],
  css: [
    'node_modules/leaflet/dist/leaflet.css',
    'src/_css/leaflet.coordinates.css',
    'src/_css/leaflet.buttons.css',
    'node_modules/leaflet-fullscreen/dist/leaflet.fullscreen.css',
    'src/_css/map.css'
  ],
  js: [
    require.resolve('leaflet'),
    'src/_js/leaflet.coordinates.js',
    'src/_js/leaflet.crosshairs.js',
    'src/_js/leaflet.levelbuttons.js',
    'src/_js/leaflet.exivabutton.js',
    'src/_js/leaflet.markersbutton.js',
    require.resolve('leaflet-fullscreen'),
    'src/_js/map.js'
  ],
  images: [
    'node_modules/leaflet-fullscreen/dist/*.png',
    'src/_css/*.png',
    'src/_img/marker-icons/*.png'
  ],
  favicon: 'src/favicon.ico',
  dist: 'dist'
};

function clean() {
  return del([paths.dist]);
}

function html() {
  return gulp.src(paths.html)
    .pipe(replace(/\.\.\/dist\//g, ''))
    .pipe(gulp.dest(`${paths.dist}/`));
}

function css() {
  return gulp.src(paths.css)
    .pipe(concat('map.css'))
    .pipe(autoprefixer())
    .pipe(cleanCSS())
    .pipe(gulp.dest(`${paths.dist}/`));
}

function js() {
  return gulp.src(paths.js)
    .pipe(concat('map.js'))
    .pipe(terser())
    .pipe(gulp.dest(`${paths.dist}/`));
}

function images() {
  return gulp.src(paths.images)
    .pipe(imagemin())
    .pipe(gulp.dest(`${paths.dist}/`));
}

function copyFavicon() {
  return gulp.src(paths.favicon)
    .pipe(gulp.dest(paths.dist));
}

function serve() {
  return gulp.src(paths.dist)
    .pipe(server({
      livereload: false,
      open: true
    }));
}

const build = gulp.series(clean, gulp.parallel(html, css, js, images, copyFavicon));

gulp.task('clean', clean);
gulp.task('html', html);
gulp.task('css', css);
gulp.task('js', js);
gulp.task('images', images);
gulp.task('copyFavicon', copyFavicon);
gulp.task('serve', serve);
gulp.task('build', build);
gulp.task('default', gulp.series('build', 'serve'));
