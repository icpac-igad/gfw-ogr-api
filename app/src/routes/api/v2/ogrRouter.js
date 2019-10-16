'use strict';


var Router = require('koa-router');
var logger = require('logger');
var ogr2ogr = require('ogr2ogr');
var XLSX = require('xlsx');
var GeoJSONSerializer = require('serializers/geoJSONSerializer');
var fs = require('fs');
var path = require('path');
var mapshaper = require('mapshaper');
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


class OGRRouterV2 {
    static * convertV2() {
        // logger.info('Converting file...', this.request.body);

        this.assert(this.request.body && this.request.body.files && this.request.body.files.file, 400, 'File required');
        var simplify = this.query.simplify || null;
        var clean = this.query.clean || false;

        var simplify_cmd = simplify ? `-simplify dp ${simplify}% ` : '';
        var clean_cmd = clean && Boolean(clean) ? '-clean ' : '';

        try {
            var ogr;

            if (this.request.body.files.file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'){
                logger.debug('It is an excel file');
                var xslxFile = XLSX.readFile(this.request.body.files.file.path);
                var csvPAth = path.parse(this.request.body.files.file.path);
                csvPAth.ext = '.csv';
                csvPAth.base = csvPAth.name + csvPAth.ext;
                XLSX.writeFile(xslxFile, path.format(csvPAth), {type:'file', bookType: 'csv'});
                this.request.body.files.file.path = path.format(csvPAth);
                //logger.debug(buf);
                ogr = ogr2ogr(this.request.body.files.file.path);
                ogr.project('EPSG:4326')
                .timeout(60000); // increase default ogr timeout of 15 seconds to match control-tower
                ogr.options(['-oo','GEOM_POSSIBLE_NAMES=*geom*','-oo','HEADERS=AUTO','-oo','X_POSSIBLE_NAMES=Lon*','-oo','Y_POSSIBLE_NAMES=Lat*','-oo','KEEP_GEOM_COLUMNS=NO']);
            }
            else {
                ogr = ogr2ogr(this.request.body.files.file.path);
                ogr.project('EPSG:4326')
                .timeout(60000); // increase default ogr timeout of 15 seconds to match control-tower

                if (this.request.body.files.file.type === 'text/csv' || this.request.body.files.file.type ==='application/vnd.ms-excel') {
                logger.debug('csv transforming ...');
                // @TODO
                ogr.options(['-oo','GEOM_POSSIBLE_NAMES=*geom*','-oo','HEADERS=AUTO','-oo','X_POSSIBLE_NAMES=Lon*','-oo','Y_POSSIBLE_NAMES=Lat*','-oo','KEEP_GEOM_COLUMNS=NO']);
                }
                else {
                    ogr.options(['-dim', '2']);
                }

            }
            var result = yield ogrExec(ogr);

            var input_obj = {
                'input.geojson': result
            };

            var command_string = `-i input.geojson ${simplify_cmd}${clean_cmd}-o format=geojson`;
            var result_post_mapshaper = mapshaper.applyCommands(command_string, input_obj, function(Error, data) {
                if (Error) {
                    logger.error(Error);
                }
                return JSON.stringify(data);
            });

            console.log('RETURNED DATA', result_post_mapshaper);
            this.body = GeoJSONSerializer.serialize(result_post_mapshaper);
        } catch (e) {
            logger.error('Error convertV2 file', e);
            this.throw(400, e.message.split('\n')[0]);
        } finally {
            logger.debug('Removing file');
            yield unlink(this.request.body.files.file.path);
        }
    }
}

router.post('/convert', koaBody, OGRRouterV2.convertV2);


module.exports = router;
