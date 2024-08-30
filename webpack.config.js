const path = require('path');

module.exports = {
    entry: '.src/index.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },

    module: {
        rules: [
            {
                sideEffects: false // Enables tree shaking so that we don't accidentally load vorvis encoder
            }
        ]
    },
    mode: 'production',
}