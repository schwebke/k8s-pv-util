describe('create snapshots by label', () => {
   const assert = require('assert');
   const api = require('./test-snapshot-api.js');
   api.db.pvc.metadata.annotations.volumeBackupSequence = "1"; // assign sequence to test for increment

   it('Snapshot Creation', async () => {
      console.log('mock server running on '+api.port)

      process.env.DEBUG = 1;
      process.env.K8SAPI = 'http://127.0.0.1:'+api.port;
      process.env.PVC_LABEL = 'true';
      const Snapshotter = require('../snapshotter.js');
      let snapshotter = new Snapshotter();
      await snapshotter.createSnapshots();

      console.log('snapshotter.createSnapshots() done');
      api.server.close();

      assert(api.db.vss.length === 1); // volume snapshot created
      assert(api.db.pvc.metadata.annotations.volumeBackupSequence === "2"); // incremented sequence value: "2"

      console.log("db:\n"+JSON.stringify(api.db, null, 3));
   });
});
