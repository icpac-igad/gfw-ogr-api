
const Router = require('koa-router');
const logger = require('logger');
const ogr2ogr = require('ogr2ogr');
const XLSX = require('xlsx');
const GeoJSONSerializer = require('serializers/geoJSONSerializer');
const fs = require('fs');
const path = require('path');
const koaBody = require('koa-body')({
    multipart: true,
    formidable: {
        uploadDir: '/tmp',
        onFileBegin(name, file) {
            const folder = path.dirname(file.path);
            file.path = path.join(folder, file.name);
        }
    }
});


const router = new Router({
    prefix: '/ogr'
});

const ogrExec = function (ogr) {
    return function (callback) {
        ogr.exec(callback);
    };
};

const unlink = function (file) {
    return function (callback) {
        fs.unlink(file, callback);
    };
};


class OGRRouter {

    static* convert() {
        // logger.debug('Converting file...', this.request.body);

        this.assert(this.request.body && this.request.body.files && this.request.body.files.file, 400, 'File required');

        try {
            let ogr;

            if (this.request.body.files.file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
                logger.debug('IT IS A excel');
                const xslxFile = XLSX.readFile(this.request.body.files.file.path);
                const csvPAth = path.parse(this.request.body.files.file.path);
                csvPAth.ext = '.csv';
                csvPAth.base = csvPAth.name + csvPAth.ext;
                XLSX.writeFile(xslxFile, path.format(csvPAth), { type: 'file', bookType: 'csv' });
                this.request.body.files.file.path = path.format(csvPAth);
                // logger.debug(buf);
                ogr = ogr2ogr(this.request.body.files.file.path);
                ogr.project('EPSG:4326')
                    .timeout(60000); // increase default ogr timeout of 15 seconds to match control-tower
                ogr.options(['-oo', 'GEOM_POSSIBLE_NAMES=*geom*', '-oo', 'HEADERS=AUTO', '-oo', 'X_POSSIBLE_NAMES=Lon*', '-oo', 'Y_POSSIBLE_NAMES=Lat*', '-oo', 'KEEP_GEOM_COLUMNS=NO']);
            } else {
                ogr = ogr2ogr(this.request.body.files.file.path);
                ogr.project('EPSG:4326')
                    .timeout(60000); // increase default ogr timeout of 15 seconds to match control-tower

                if (this.request.body.files.file.type === 'text/csv' || this.request.body.files.file.type === 'application/vnd.ms-excel') {
                    logger.debug('csv transforming ...');
                    // @TODO
                    ogr.options(['-oo', 'GEOM_POSSIBLE_NAMES=*geom*', '-oo', 'HEADERS=AUTO', '-oo', 'X_POSSIBLE_NAMES=Lon*', '-oo', 'Y_POSSIBLE_NAMES=Lat*', '-oo', 'KEEP_GEOM_COLUMNS=NO']);
                } else {
                    ogr.options(['-dim', '2']);
                }

            }
            const result = yield ogrExec(ogr);
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
