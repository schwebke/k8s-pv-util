module.exports = {

   // build self link from object (which is deprecated since kubernetes 1.16)
   selfLink: (obj) => {
      let group;
      let name;
      if (obj.kind === 'PersistentVolumeClaim') {
	 group = '/api/v1/namespaces/';
	 name = '/persistentvolumeclaims/';
      }
      if (obj.kind === 'VolumeSnapshot') {
	 group = '/apis/snapshot.storage.k8s.io/v1alpha1/namespaces/';
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
   }

};
