# Docker Compose 闀滃儚閮ㄧ讲

IT_IMP 閲囩敤鍗曟枃浠?Compose 閮ㄧ讲锛氱洿鎺ユ媺鍙?Docker Hub 闀滃儚锛屼笉闇€瑕?`.env`銆佹簮鐮併€丯ode.js 鎴栨湰鏈烘瀯寤恒€?

## 瀹屾暣甯︽敞閲?Compose

璇风洿鎺ユ煡鐪嬫垨涓嬭浇浠撳簱涓殑 [`docker-compose.yml`](docker-compose.yml)銆傚畠鏄敮涓€鐨勫叕寮€閮ㄧ讲绀轰緥锛屾墍鏈夊彲淇敼椤归兘甯︿腑鏂囩敤閫旇鏄庡拰鍚岃绀轰緥锛涗笉瑕佸皢涓汉瀵嗙爜銆丣WT 瀵嗛挜鎴?NAS 鐨勫疄闄呬笟鍔¤矾寰勬彁浜ゅ洖 GitHub銆?

## 鐢ㄦ埛閮ㄧ讲

```bash
mkdir -p /vol1/1000/docker/IT_IMP_docker
cd /vol1/1000/docker/IT_IMP_docker
curl -fsSLO https://raw.githubusercontent.com/linjuli1956/IT_IMP/main/deploy/docker/docker-compose.yml
nano docker-compose.yml
docker compose up -d
```

浠撳簱涓殑 [`docker-compose.yml`](docker-compose.yml) 鏈韩灏辨槸甯﹀畬鏁存敞閲婄殑閮ㄧ讲绀轰緥銆傞娆″彧闇€鍦ㄩ《閮ㄧ殑鈥滈儴缃查厤缃€濆尯鍩燂紝鎸夊悓琛岀ず渚嬩慨鏀逛笁椤癸細

- `mysql-root-password`锛歁ySQL root 瀵嗙爜锛屼緥濡?`MySql@2026#Secure`锛?
- `jwt-secret`锛氱敤浜庣櫥褰曡璇佺殑闀块殢鏈哄瘑閽ワ紝渚嬪 `JwtSecret@2026#IT_IMP`锛?
- `initial-admin-password`锛氶娆＄鐞嗗憳瀵嗙爜锛屼緥濡?`Admin@2026#Secure`銆?

涓嶈鐩存帴浣跨敤涓枃鍗犱綅鍊兼垨绀轰緥鍊笺€傛湭淇敼鈥滀綘鐨凪ySQL寮哄瘑鐮佲€濃€滀綘鐨凧WT寮哄瘑閽モ€濇垨鈥滀綘鐨勭鐞嗗憳瀵嗙爜鈥濇椂锛孋ompose 浼氬湪鍚姩鏁版嵁搴撳墠鍋滄骞舵彁绀洪厤缃敊璇€傚瘑鐮佸寘鍚?`$` 鏃讹紝鍦?Compose 涓』鍐欐垚 `$$`銆?

## 绔彛涓庢暟鎹洰褰?

榛樿绔彛锛?

```text
Web锛?1956 -> 3000锛岃闂?http://NAS_IP:31956
MySQL锛?307 -> 3306锛屽眬鍩熺綉閫氳繃 NAS_IP:3307 浠?root 鐧诲綍
```

`3307` 鍙敤浜?NAS 澶栭儴璁块棶锛沇eb 涓?MySQL 鍦ㄥ悓涓€涓?Docker 缃戠粶鍐咃紝Web 鍥哄畾杩炴帴 `db:3306`銆備笉瑕佹妸 `web.environment.DATABASE_PORT` 鏀逛负 `3307`锛屽惁鍒?Web 鏃犳硶杩炴帴鏁版嵁搴撱€?

榛樿鏁版嵁鐩綍鐩稿浜?Compose 鏂囦欢锛?

```text
./data/mysql  鏁版嵁搴撴枃浠?
./data/app    PDF銆乆LSX銆侀檮浠朵笌鏃ュ織
```

NAS 闇€瑕佸浐瀹氳矾寰勬椂锛岀洿鎺ュ湪 Compose 椤堕儴灏嗕袱涓洰褰曟敼涓猴細

```text
/vol1/1000/docker/IT_IMP_docker/data/mysql
/vol1/1000/docker/IT_IMP_docker/data/app
```

MySQL 鐨勮繙绋?root 鏉冮檺鍙湪绌烘暟鎹洰褰曢娆″垵濮嬪寲鏃跺垱寤恒€傚凡鏈夋暟鎹簱涓嶄細鍥犱负淇敼 Compose 鑷姩鏀瑰彉璐﹀彿鏉冮檺銆?

## 闀滃儚鐗堟湰涓庢洿鏂?

榛樿闀滃儚鏄?`linjuli2026/it-imp-web:latest`銆傝嫢瑕佸浐瀹氬埌鏌愭鏃ユ湡鍙戝竷锛屽皢 `web` 鏈嶅姟鐨勯暅鍍忔敼涓猴細

```yaml
image: linjuli2026/it-imp-web:20260816
```

鏇存柊鏈€鏂伴暅鍍忥細

```bash
docker compose pull
docker compose up -d
```

## 绠＄悊鍛樺瘑鐮佹仮澶?

鍏堝湪 Compose 椤堕儴淇敼 `initial-admin-password`锛屽啀鎵ц锛?

```bash
docker compose run --rm --no-deps --entrypoint node web /app/web/scripts/bootstrap-admin.mjs --reset
```

璇ュ懡浠ゅ彧閲嶇疆鎸囧畾绠＄悊鍛樺瘑鐮侊紝涓嶄細閲嶅缓鏁版嵁搴撴垨淇敼鍏朵粬鐢ㄦ埛銆傛暟鎹簱涓嶅彲杩炴帴鏃朵笉鑳介噸缃瘑鐮侊紝鍥犱负瀵嗙爜鍝堝笇瀛樺偍鍦?MySQL 涓€?
