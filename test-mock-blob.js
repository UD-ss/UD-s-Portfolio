let mockStore = {};
let locked = false;
let queue = [];

async function acquire() {
    if (!locked) { locked = true; return; }
    await new Promise(function(resolve) { queue.push(resolve); });
}

function release() {
    if (queue.length > 0) { queue.shift()(); }
    else { locked = false; }
}

module.exports = {
    list: async (opts) => {
        await acquire();
        try {
            const prefix = opts.prefix || '';
            const blobs = Object.keys(mockStore)
                .filter(function(k) { return k.startsWith(prefix); })
                .map(function(k) { return { pathname: k, url: 'mock://' + k }; });
            return { blobs };
        } finally {
            release();
        }
    },
    put: async function(pathname, body, opts) {
        await acquire();
        try {
            mockStore[pathname] = body;
            return { url: 'mock://' + pathname };
        } finally {
            release();
        }
    },
    del: async function(pathname) {
        await acquire();
        try {
            delete mockStore[pathname];
        } finally {
            release();
        }
    },
    _reset: function() {
        Object.keys(mockStore).forEach(function(k) { delete mockStore[k]; });
        locked = false;
        queue = [];
    },
    _getStore: function() { return mockStore; },
    _set: function(s) {
        Object.keys(mockStore).forEach(function(k) { delete mockStore[k]; });
        Object.assign(mockStore, s);
    }
};
