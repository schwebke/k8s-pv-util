describe('create all labeled snapshots', () => {
   const assert = require('assert');
   const api = require('./test-snapshot-api.js');

   it('Snapshot Creation', async () => {
      console.log('mock server running on '+api.port)

      process.env.DEBUG = 1;
      process.env.K8SAPI = 'http://127.0.0.1:'+api.port;
      const Snapshotter = require('../snapshotter.js');
      let snapshotter = new Snapshotter();
      await snapshotter.createSnapshots();

      console.log('snapshotter.createSnapshots() done');
      api.server.close();

      assert(api.db.vss.length === 1); // volume snapshot created
      assert(api.db.pvc.metadata.annotations.volumeBackupSequence === "1"); // initial sequence value: "1"

      console.log("db:\n"+JSON.stringify(api.db, null, 3));
   });
});
