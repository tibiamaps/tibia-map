'use strict';

const del = require('del');
const gulp = require('gulp');

const autoprefixer = require('gulp-autoprefixer');
const cleanCSS = require('gulp-clean-css');
const concat = require('gulp-concat');
const imagemin = require('gulp-imagemin');
const replace = require('gulp-replace');
const server = require('gulp-webserver');
const terser = require('gulp-terser');

gulp.task('clean', function() {
	return del('dist/*');
});

gulp.task('html', ['clean'], function() {
	gulp.src([
		'src/index.html',
		'src/small.html',
		'src/embed.html'
	])
		.pipe(replace(/\.\.\/dist\//g, ''))
		.pipe(gulp.dest('./dist/'));

	gulp.src([
		'src/index.html'
	])
		.pipe(replace(/\.\.\/dist\//g, '../'))
		.pipe(gulp.dest('./dist/embed/'));
});

gulp.task('css', function() {
	gulp.src([
		require.resolve('leaflet/dist/leaflet.css'),
		'src/_css/leaflet.coordinates.css',
		'src/_css/leaflet.levelbuttons.css',
		'node_modules/leaflet-fullscreen/dist/leaflet.fullscreen.css',
		'src/_css/map.css'
	])
		.pipe(concat('map.css'))
		.pipe(autoprefixer()) // This (also) removes unneeded prefixes.
		.pipe(cleanCSS())
		.pipe(gulp.dest('./dist/'));
});

gulp.task('js', function() {
	gulp.src([
		require.resolve('leaflet'),
		'src/_js/leaflet.coordinates.js',
		'src/_js/leaflet.crosshairs.js',
		'src/_js/leaflet.levelbuttons.js',
		require.resolve('leaflet-fullscreen'),
		'src/_js/map.js'
	])
		.pipe(concat('map.js'))
		.pipe(terser())
		.pipe(gulp.dest('./dist/'));
});

gulp.task('img', function() {
	gulp.src([
		'node_modules/leaflet-fullscreen/dist/*.png',
		'src/_css/*.png'
	])
		//.pipe(imagemin({
		//	'optimizationLevel': 7
		//}))
		.pipe(gulp.dest('./dist/'));
});

gulp.task('copy', function() {
	gulp.src(
		'src/favicon.ico'
	)
		.pipe(gulp.dest('./dist/'));
});

//gulp.task('watch', function() {
//	gulp.watch('src/**', ['default']);
//});

gulp.task('serve', function() {
	gulp.src('dist')
		.pipe(server({
			'livereload': false,
			'open': true
		}));
});

gulp.task('build', ['clean', 'html', 'css', 'js', 'img', 'copy']);
gulp.task('default', ['build', 'serve']);
