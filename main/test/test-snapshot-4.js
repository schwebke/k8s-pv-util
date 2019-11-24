describe('skip snapshots by label', () => {
   const assert = require('assert');

   it('Snapshot Creation', async () => {
      console.log('no mock server running on');

      process.env.DEBUG = 1;
      process.env.K8SAPI = 'http://127.0.0.1:18080';
      process.env.PVC_LABEL = 'other_label';
      const Snapshotter = require('../snapshotter.js');
      let snapshotter = new Snapshotter();
      try {
	 await snapshotter.createSnapshots();

	 //  never executed, if exception is properly thrown
	 assert(false);
      } catch (err) {
	 console.log('got expected error: '+err);
      }
   });
});
