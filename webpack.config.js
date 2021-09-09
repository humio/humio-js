const path = require('path');
const webpack = require('webpack');

const config = {
    entry: './index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'humio.browser.js',
        library: "Humio",
    },
    module: {

    },
    resolve: {
        fallback: {
            http: require.resolve('stream-http'),
            https: require.resolve('stream-http'),
            process: require.resolve('process/browser'),
            url: require.resolve('url'),
            util: require.resolve('util'),
            buffer: require.resolve('buffer')
        },
    },
    plugins: [
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer']
        })
    ]
};

module.exports = config
