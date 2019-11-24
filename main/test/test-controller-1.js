describe('claim snapshots', () => {
   const assert = require('assert');
   const api = require('./test-controller-api.js');

   process.env.DEBUG = 1;
   process.env.K8SAPI = 'http://127.0.0.1:'+api.port;
   process.env.S3BASEURL = 's3://example.org/data';
   const Controller = require('../controller.js');
   let controller = new Controller();

   it('PVC Creation', async () => {
      console.log('mock server running on '+api.port)

      await controller.claimSnapshots();
      console.log('controller.claimSnapshots() done');
      assert(api.db.pvcs.items.length === 2); // volume snapshot created

      await controller.claimSnapshots();
      console.log('controller.claimSnapshots() done');
      assert(api.db.pvcs.items.length === 2); // no further snapshot created

      console.log("db:\n"+JSON.stringify(api.db, null, 3));
   });

   it('Job Creation', async () => {
      await controller.backupJobs();
      console.log('controller.backupJobs() done');
      assert(api.db.jobs.items.length === 1); // job created

      await controller.backupJobs();
      console.log('controller.backupJobs() done');
      assert(api.db.jobs.items.length === 1); // no further job created

      console.log("db:\n"+JSON.stringify(api.db, null, 3));
   });

   it('Job Cleanup 0', async () => {
      await controller.cleanup();
      console.log('controller.cleanup() done');
      assert(api.db.vss.items.length === 1); // volume snapshot present
      assert(api.db.pvcs.items.length === 2); // volume snapshot claimed
      assert(api.db.jobs.items.length === 1); // job present
   });

   it('Job Cleanup 1', async () => {
      // mark job as succeeded
      api.db.jobs.items[0].status = { 'succeeded': 1 };
      await controller.cleanup();
      await controller.cleanup();
      await controller.cleanup();
      console.log('controller.cleanup()s done');
      assert(api.db.vss.items.length === 0); // volume snapshot deleted
      assert(api.db.pvcs.items.length === 1); // volume snapshot claim deleted
      assert(api.db.jobs.items.length === 0); // job deleted

      console.log("db:\n"+JSON.stringify(api.db, null, 3));
   });

   it('shutdown server', async () => {
      await api.server.close();
   });
});
