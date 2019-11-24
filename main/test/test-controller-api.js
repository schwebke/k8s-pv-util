const jsonServer = require('json-server');
const bodyParser = require('body-parser');
const server = jsonServer.create();

let db = require('./test-controller-api.json');

const router = jsonServer.router(db);
const middlewares = jsonServer.defaults();
const port = 18001;

server.use(middlewares);

// flatten sub resources
server.use(jsonServer.rewriter({
   '/api/v1/persistentvolumeclaims': '/pvcs',
   '/api/v1/namespaces/app/persistentvolumeclaims': '/pvc',
   '/apis/snapshot.storage.k8s.io/v1alpha1/volumesnapshots': '/vss',
   '/apis/batch/v1/jobs': '/jobs',
   '/apis/batch/v1/namespaces/app/jobs': '/job',
   '/apis/snapshot.storage.k8s.io/v1alpha1/namespaces/app/volumesnapshots/volumebackup-129337a1-a27c-4cff-a47e-713656b493d6': '/vs',
   '/api/v1/namespaces/app/persistentvolumeclaims/volumebackup-129337a1-a27c-4cff-a47e-713656b493d6': '/pvc',
   '/apis/batch/v1/namespaces/app/jobs/volumebackup-129337a1-a27c-4cff-a47e-713656b493d6': '/job'
}));

server.use(bodyParser.json({'type': '*/*'}));
server.use((req, res, next) => {
   console.log(req.method+' '+req.path);
   if (req.path === '/pvc' && req.method === 'POST') {
      db.pvcs.items.push(req.body); // append also to pvcs items
   }
   if (req.path === '/job' && req.method === 'POST') {
      db.jobs.items.push(req.body); // append also to jobs items
   }
   if (req.method === 'DELETE') {
      if (req.path === '/vs') {
	 db.vss.items.pop();
      }
      if (req.path === '/pvc') {
	 db.pvcs.items.pop();
      }
      if (req.path === '/job') {
	 db.jobs.items.pop();
      }
      res.end();
      return;
   }
   if (req.path.includes('/pods/') && req.method === 'GET') {
      res.jsonp({ items: [] });
      return;
   }
   next();
});

server.use(router);

module.exports = {
   'server': server.listen(port),
   'db': db,
   'port': port
};
