describe('skip snapshots by label', () => {
   const assert = require('assert');
   const api = require('./test-snapshot-api.js');

   it('Snapshot Creation', async () => {
      console.log('mock server running on '+api.port)

      process.env.DEBUG = 1;
      process.env.K8SAPI = 'http://127.0.0.1:'+api.port;
      process.env.PVC_LABEL = 'other_label';
      const Snapshotter = require('../snapshotter.js');
      let snapshotter = new Snapshotter();
      await snapshotter.createSnapshots();

      console.log('snapshotter.createSnapshots() done');
      api.server.close();

      assert(api.db.vss.length === 0); // no volume snapshot created

      console.log("db:\n"+JSON.stringify(api.db, null, 3));
   });
});
