const jsonServer = require('json-server');
const bodyParser = require('body-parser');
const server = jsonServer.create();

let db = require('./test-snapshot-api.json');
db.pvc = db.pvcs.items[0];

const router = jsonServer.router(db);
const middlewares = jsonServer.defaults();
const port = 18001;

server.use(middlewares);

// flatten sub resources
server.use(jsonServer.rewriter({
   '/api/v1/persistentvolumeclaims': '/pvcs',
   '/api/v1/namespaces/app/persistentvolumeclaims/app-accounts-pvc': '/pvc',
   '/apis/snapshot.storage.k8s.io/v1alpha1/namespaces/app/volumesnapshots': '/vss'
}));

// handle also application/merge-patch+json
server.use(bodyParser.json({'type': '*/*'}));
server.use((req, res, next) => {
   if (req.path === '/pvc' && req.method === 'PATCH') {
      db.pvc = Object.assign(db.pvc, req.body);
   }
   next();
});

server.use(router);

module.exports = {
   'server': server.listen(port),
   'db': db,
   'port': port
};
