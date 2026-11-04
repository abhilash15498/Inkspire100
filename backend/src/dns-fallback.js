import dns from 'node:dns';
import { Resolver } from 'node:dns/promises';

const fallbackResolver = new Resolver();
fallbackResolver.setServers(['8.8.8.8', '1.1.1.1']);

const origLookup = dns.lookup;

if (!dns.__hasFallbackHook) {
  dns.__hasFallbackHook = true;
  dns.lookup = function (hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    origLookup(hostname, options, (err, address, family) => {
      if (!err) {
        return callback(null, address, family);
      }

      // Skip fallback for localhost or literal IPs
      if (
        !hostname ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
      ) {
        return callback(err);
      }

      fallbackResolver
        .resolve4(hostname)
        .then((addrs) => {
          if (!addrs || !addrs.length) {
            return callback(err);
          }
          if (options && options.all) {
            return callback(
              null,
              addrs.map((a) => ({ address: a, family: 4 }))
            );
          }
          return callback(null, addrs[0], 4);
        })
        .catch(() => callback(err));
    });
  };
}

