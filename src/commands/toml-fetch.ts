//

import axios from "axios"
import {STELLAR_TOML_MAX_SIZE} from "../services/TomlService";

main();

async function main() {
    let source = axios.CancelToken.source();
    setTimeout(() => {
        source.cancel('Connection time-out');
        // Timeout Logic
    }, 2000);
    await axios.get('https://stablecoincorp.com/.well-known/stellar.toml', {
        cancelToken: source.token,
        maxContentLength: STELLAR_TOML_MAX_SIZE,
        timeout: 2000,
        headers: { 'User-Agent': 'stellarbeat.io' }
    }).catch(e => console.log(e));
}