require('log-timestamp');
const rp = require('request-promise');
const K8SAPI = process.env.K8SAPI || 'http://127.0.0.1:8001';

let self = module.exports = {

   // build self link from object (which is deprecated since kubernetes 1.16)
   selfLink: (obj) => {
      let group;
      let name;
      if (obj.kind === 'PersistentVolumeClaim') {
	 group = '/api/v1/namespaces/';
	 name = '/persistentvolumeclaims/';
      }
      if (obj.kind === 'VolumeSnapshot') {
	 group = '/apis/'+self.api.snapshot+'/namespaces/';
	 name = '/volumesnapshots/';
      }
      if (obj.kind === 'Pod') {
	 group = '/api/v1/namespaces/';
	 name = '/pods/';
      }
      if (obj.kind === 'Job') {
	 group = '/apis/batch/v1/namespaces/';
	 name = '/jobs/';
      }
      if (group && name) {
	 return group+obj.metadata.namespace+name+obj.metadata.name;
      }
      console.error('cannot build selfLink, unknown object kind '+obj.kind+"\n"+JSON.stringify(obj));
      process.exit(1);
   },

   // api prefixes
   api: {},

   // get snapshot api prefix (1.16... alpha, 1.18... beta)
   initApi: async () => {
      DEBUG && console.log('');
      DEBUG && console.log('query snapshot api');
      let res = await rp(K8SAPI+'/apis/snapshot.storage.k8s.io/');
      let o = JSON.parse(res);
      DEBUG && console.log('snapshot groupVersion: '+o.preferredVersion.groupVersion;
      self.api.snapshot = o.preferredVersion.groupVersion;
      return self.api;
   }

};
