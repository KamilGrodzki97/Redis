var express = require('express')
var app = express()
var Redis = require('ioredis');

var redis = new Redis({
    port: 17518,
    host: 'redis-17518.c250.eu-central-1-1.ec2.cloud.redislabs.com',
    family: 4,
    password: 'JaUQrWFLCnCUNreaGcDIQFrm5rY9lCJ8',
    db: 0
})

var header = ``;

function buildHtml(req, header, body) {
    return '<!DOCTYPE html>'
        + '<html><head>' + header + '</head><body>' + body + '</body></html>';
};

app.get('/', function (req, res) {
    redis.get(`app`, function (err, appName) {

                    let body = `
                            <h3>Pojedyńcze dane</h3>
                            <p>Wyświetlenie nazwy firmy</p>
                            <a href="/companyname">Nazwa firmy</a><br><br>
                            <h3>Klucze</h3>
                            <p>Wyświetlenie wszystkich kluczy oraz ich wartości</p>
                            <a href="/keys">Klucze</a><br><br>
                            <h3>Tablica</h3>
                            <p>Wyświetlenie opisów zgłoszeń</p>
                            <a href="/tablica">Tablica opisów ticketów</a><br><br>
                            <h3>Deweloperzy</h3>
                            <p>Wyświetlenie devów za pomocą url</p>
                            <a href="/developer/120484">Deweloper 1</a><br>
                            <a href="/developer/123456">Deweloper 2</a><br>
                            <a href="/developer/124785">Deweloper 3</a><br><br>
                            <h3>Seniorzy</h3>
                            <p>Wyświetlenie imion wszystkich seniorów</p>
                            <a href="/seniordeveloper">Seniorzy</a><br><br>
                            <h3>Skrypt LUA</h3
                            <p>Skrypt wyświetla listę seniorów wraz z ewentualnym opisem ticketów im przypisanych</p>
                            <p>[ID SENIORA], [IMIE], [NAZWISKO], [OPIS]</p>
                            <a href="/lua">Skrypt LUA</a><br><br>
                            <h3>Seniorzy, którzy mają "na sobie" przypisane tickety</h3>
                            <a href="/seniors_with_id">Seniorzy</a><br><br>`;

                    res.send(buildHtml(req, header, body))
                });

})

app.get('/companyname', function (req, res) {
    redis.get('companyname', function (err, result) {
        body = `Nazwa firmy: ${result}`
        res.send(buildHtml(req, header, body))
    });
})

app.get('/keys', function (req, res) {
    var list = `<table style="width:30%">
                    <tr>
                    <th>Lp</th>
                    <th>Klucz</th>
                    </tr>
                `;

    redis.keys('*', function (err, result) {
        for (var i = 0; i < result.length; ++i) {
            list += `<tr>
                <td> ` + (i + 1) + `</td>` +
                `<td>` + result[i] + `</td>`;
        }
        list += `</table>`;

        body = `${list}`
        res.send(buildHtml(req, header, body))
    });
})

app.get('/tablica', function (req, res) {
    redis.lrange(`subject`, '0', '-1', function (err, result) {
        body = `${result}`
        res.send(buildHtml(req, header, body))
    });
})

app.get('/developer/:id', function (req, res) {
    redis.hget(`developer:${req.params.id}`, `name`, function (err, name) {
        redis.hget(`developer:${req.params.id}`, `surname`, function (err, surname) {
            redis.hget(`developer:${req.params.id}`, `dateofbirth`, function (err, dateofbirth) {
                redis.hget(`developer:${req.params.id}`, `specialization`, function (err, specialization) {
                body = `Imię: ${name}<br> Nazwisko: ${surname}<br> Data urodzenia: ${dateofbirth}<br> Specjalizacja: ${specialization}`
                res.send(buildHtml(req, header, body))
                });
            });
        });
    });
})

app.get('/seniordeveloper', function (req, res) {
    var list = "";
    var seniordeveloper = "<h3>IMIONA SENIORÓW</h3>";
    var pipeline = redis.pipeline();

    redis.keys('seniordeveloper:*:name', function (err, keys) {
        for (var i = 0; i < keys.length; ++i) {
            pipeline.get(keys[i]);
            list += keys[i]
        }

        pipeline.exec(function (err, result) {
            for (var i = 0; i < result.length; ++i) {
                if (i % 2 != 0) {
                    seniordeveloper += `${result[i][1]} `;
                } else {
                    seniordeveloper += `${result[i][1]} </br>`
                }
            }
            body = `${seniordeveloper}`
            res.send(buildHtml(req, header, body))
        });
    });
})

redis.defineCommand('seniordeveloper_tasks', {
    numberOfKeys: 0,
    lua: `
        local seniordeveloper = redis.call('keys', 'seniordeveloper:*:surname')
        local tasks = redis.call('keys', 'tasks:*:seniordeveloper')
        local a, b, c
        local e, f, g
        local list = {}
        
        for k, v in pairs(seniordeveloper) do
            a, b, c = string.match(v, "(.*)%:(.*)%:(.*)")
            local tasks_list = {}
            for l, z in pairs(tasks) do
                e, f, g = string.match(z, "(.*)%:(.*)%:(.*)")
            local tasknumber = redis.call('get', 'tasks:'..f..':seniordeveloper')

            if tasknumber == b then
                table.insert(tasks_list, redis.call('get', 'tasks:'..f..':title'))
            end
            end

            list[k] = {b,redis.call('get', 'seniordeveloper:'..b..':name'),redis.call('get', 'seniordeveloper:'..b..':surname'), tasks_list}
        end
        return list
    `
});

app.get('/lua', function (req, res) {
    var list = "";
    redis.seniordeveloper_tasks(function (err, result) {
        for (var i = 0; i < result.length; ++i) {
            list += result[i] + '<br>'
        }
        body = `${list}`
        res.send(buildHtml(req, header, body))
    });
});


app.get('/seniors_with_id', function (req, res) {
    var seniordeveloper_id = [];
    var seniordeveloper = `<h3>Seniorzy oraz ich przypisane id</h3><table>
        <tr>
        <th>Id</th>
        <th>Nazwisko</th>
        </tr>
    `;

    var pipeline = redis.pipeline();
    var pipeline2 = redis.pipeline();

    redis.keys('tasks:*:seniordeveloper', function (err, keys) {
        for (var i = 0; i < keys.length; ++i) {
            pipeline.get(keys[i]);
        }

        pipeline.exec(function (err, result) {
            for (var i = 0; i < result.length; ++i) {
                seniordeveloper_id[i] = `${result[i][1]}`;

                redis.keys(`seniordeveloper:${result[i][1]}:surname`, function (err, keys) {
                    for (var i = 0; i < keys.length; ++i) {
                        pipeline2.get(keys[i]);
                    }

                    pipeline2.exec(function (err, result) {
                        for (var i = 0; i < result.length; ++i)
                            seniordeveloper += `<tr> <td> ` + seniordeveloper_id[i] + `</td>` + `<td>` + result[i][1] + `</td>`;
                        seniordeveloper += '</table>'

                        body = `${seniordeveloper}`
                        res.send(buildHtml(req, header, body))
                    });
                });
            }
        });
    });
})

app.listen(8080, function () {
    console.log('Application running at port 8080');
});
