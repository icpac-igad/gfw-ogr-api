const Router = require('koa-router');
const logger = require('logger');
const ogr2ogr = require('ogr2ogr');
const XLSX = require('xlsx');
const GeoJSONSerializer = require('serializers/geoJSONSerializer');
const fs = require('fs');
const path = require('path');
const mapshaper = require('mapshaper');
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

const ogrExec = (ogr) => (callback) => {
    ogr.exec(callback);
};

const unlink = (file) => (callback) => {
    fs.unlink(file, callback);
};


class OGRRouterV2 {

    static* convertV2() {
        logger.info('Converting file...', this.request.body);

        this.assert(this.request.body && this.request.body.files && this.request.body.files.file, 400, 'File required');
        const simplify = this.query.simplify || null;
        const clean = this.query.clean || false;

        const simplifyCmd = simplify ? `-simplify visvalingam percentage=${simplify}% keep-shapes ` : '';
        const cleanCmd = clean && Boolean(clean) ? '-clean ' : '';

        try {
            let ogr;

            if (this.request.body.files.file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
                logger.debug('It is an excel file');
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
            // ogr output
            const result = yield ogrExec(ogr);


            // Mapshaper input stream from file
            const input = { 'input.json': result };
            const cmd = `-i no-topology input.json ${simplifyCmd}${cleanCmd} -each '__id=$.id' -o output.json`;
            logger.info(cmd);
            const resultPostMapshaper = yield mapshaper.applyCommands(cmd, input);
            this.body = GeoJSONSerializer.serialize(JSON.parse(resultPostMapshaper['output.json']));

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
