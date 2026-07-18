import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';
import copy from 'rollup-plugin-copy';
import del from 'rollup-plugin-delete';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

const isWatch = process.env.ROLLUP_WATCH === 'true';

export default {
	input: 'src/index.js',
	output: {
		file: 'dist/map.js',
		format: 'iife',
		sourcemap: !isWatch,
	},
	plugins: [
		// Clean the dist directory before build.
		del({ targets: 'dist/*' }),

		// Resolve node modules and convert CommonJS to ES modules.
		resolve(),
		commonjs(),

		// Bundle and minify CSS, extracting it to dist/map.css.
		postcss({
			extract: 'map.css',
			minimize: true,
			plugins: [autoprefixer(), cssnano()],
		}),

		// Minify the output JS bundle.
		terser(),

		// Copy and transform assets.
		copy({
			targets: [
				{
					src: ['src/index.html', 'src/small.html', 'src/embed.html'],
					dest: 'dist',
					transform: (contents) =>
						contents.toString().replace(/\.\.\/dist\//g, ''),
				},
				{
					src: 'src/index.html',
					dest: 'dist/embed',
					transform: (contents) =>
						contents.toString().replace(/\.\.\/dist\//g, '../'),
				},
				{
					src: 'node_modules/leaflet-fullscreen/dist/*.png',
					dest: 'dist',
				},
				{
					src: 'src/_css/*.png',
					dest: 'dist',
				},
				{
					src: 'src/_img/marker-icons/*.png',
					dest: 'dist/_img/marker-icons',
				},
				{
					src: 'src/_json/areas.json',
					dest: 'dist/_json',
				},
				{
					src: 'src/favicon.ico',
					dest: 'dist',
				},
			],
		}),

		// Start dev server in watch mode.
		isWatch &&
			serve({
				contentBase: 'dist',
				port: 10015,
				open: true,
			}),

		// Reload browser on changes in watch mode.
		isWatch && livereload('dist'),
	].filter(Boolean),
};
