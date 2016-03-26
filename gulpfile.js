'use strict';

const del = require('del');
const gulp = require('gulp');

const autoprefixer = require('gulp-autoprefixer');
const cleanCSS = require('gulp-clean-css');
const concat = require('gulp-concat');
const imagemin = require('gulp-imagemin');
const replace = require('gulp-replace');
const uglify = require('gulp-uglify');

gulp.task('clean', function() {
	del('dist/*');
});

gulp.task('html', function() {
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
		'src/_css/leaflet.css',
		'src/_css/leaflet.coordinates.css',
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
		'src/_js/leaflet.js',
		'src/_js/leaflet.coordinates.js',
		'src/_js/leaflet.crosshairs.js',
		'node_modules/leaflet-fullscreen/dist/Leaflet.fullscreen.min.js',
		'src/_js/map.js'
	])
	.pipe(concat('map.js'))
	.pipe(uglify())
	.pipe(gulp.dest('./dist/'));
});

gulp.task('img', function() {
	gulp.src([
		'node_modules/leaflet-fullscreen/dist/*.png',
		'src/_css/*.png'
	])
//	.pipe(imagemin({
//		'optimizationLevel': 7
//	}))
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

gulp.task('default', ['clean', 'html', 'css', 'js', 'img', 'copy']);
