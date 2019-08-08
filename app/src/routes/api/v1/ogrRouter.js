'use strict';


var Router = require('koa-router');
var logger = require('logger');
var ogr2ogr = require('ogr2ogr');
var GeoJSONSerializer = require('serializers/geoJSONSerializer');
var fs = require('fs');
var path = require('path');
var koaBody = require('koa-body')({
    multipart: true,
    formidable: {
        uploadDir: '/tmp',
        onFileBegin: function(name, file) {
            var folder = path.dirname(file.path);
            file.path = path.join(folder, file.name);
        }
    }
});


var router = new Router({
    prefix: '/ogr'
});

var ogrExec = function(ogr) {
    return function(callback) {
        ogr.exec(callback);
    };
};

var unlink = function(file) {
    return function(callback) {
        fs.unlink(file, callback);
    };
};


class OGRRouter {
    static * convert() {
        //logger.debug('Converting file...', this.request.body);

        this.assert(this.request.body && this.request.body.files && this.request.body.files.file, 400, 'File required');

        try {
            var ogr = ogr2ogr(this.request.body.files.file.path);
            ogr.project('EPSG:4326')
	        .timeout(60000); // increase default ogr timeout of 15 seconds to match control-tower
            if (this.request.body.files.file.type === 'text/csv'|| this.request.body.files.file.type ==='application/vnd.ms-excel') {
                logger.error('IT IS A CSV');
                // @TODO
                ogr.options(['-oo','GEOM_POSSIBLE_NAMES=*geom*','-oo','HEADERS=AUTO','-oo','X_POSSIBLE_NAMES=Lon*','-oo','Y_POSSIBLE_NAMES=Lat*','-oo','KEEP_GEOM_COLUMNS=NO']);
            } else if (this.request.body.files.file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'){

                logger.debug('IT IS A excel');
                ogr.options(['-oo','OGR_XLSX_HEADERS=FORCE','-oo','X_POSSIBLE_NAMES=Lon*','-oo','Y_POSSIBLE_NAMES=Lat*']);

            } 
            else {
                ogr.options(['-dim', '2']);
            }
            var result = yield ogrExec(ogr);
            // logger.debug(result);
            this.body = GeoJSONSerializer.serialize(result);
        } catch (e) {
            logger.error('Error convert file', e);
            this.throw(400, e.message.split('\n')[0]);
        } finally {
            logger.debug('Removing file');
            yield unlink(this.request.body.files.file.path);
        }
    }
}

router.post('/convert', koaBody, OGRRouter.convert);


module.exports = router;
