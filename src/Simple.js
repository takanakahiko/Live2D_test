// JavaScriptで発生したエラーを取得
window.onerror = function (msg, url, line, col, error) {
    var errmsg = "file:" + url + "<br>line:" + line + " " + msg;
    Simple.myerror(errmsg);
};

var mousePos = {x:0.5, y:0.5};
var canvas = document.getElementById("glcanvas");
canvas.addEventListener('mousemove', function(e){
    var rect = e.target.getBoundingClientRect();
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
    currentX = x / rect.width;
    currentY = y / rect.height;
    mousePos.x += ((currentX - mousePos.x) / 20);
    mousePos.y += ((currentY - mousePos.y) / 20);
});

var Simple = function () {
    
    this.live2DModel = null; //Live2Dモデルのインスタンス
    this.requestID = null; //アニメーションを停止するためのID
    this.loadLive2DCompleted = false; //モデルのロードが完了したら true
    this.initLive2DCompleted = false; //モデルの初期化が完了したら true
    this.loadedImages = []; //WebGL Image型オブジェクトの配列
    this.motions = [];      // モーション配列
    this.motionMgr = null;  // モーションマネジャー
    this.motionnm = 0;      // モーション番号
    this.sounds = [];       // サウンド配列
    this.soundnum = 0;      // サウンド番号
    this.isIdle = true;
    
    /**
    * Live2D モデル設定。
    */
    this.modelDef = {
        "type" : "Live2D Model Setting",
        "name" : "haru",
        "model" : "../LIB/Live2D_SDK_WebGL_2.0.05_1_jp/sample/Simple/assets/haru/haru.moc",
        "textures" : [
            "../LIB/Live2D_SDK_WebGL_2.0.05_1_jp/sample/Simple/assets/haru/haru.1024/texture_00.png",
            "../LIB/Live2D_SDK_WebGL_2.0.05_1_jp/sample/Simple/assets/haru/haru.1024/texture_01.png",
            "../LIB/Live2D_SDK_WebGL_2.0.05_1_jp/sample/Simple/assets/haru/haru.1024/texture_02.png"
        ],
        "motions" : [
            "../LIB/Live2D_SDK_WebGL_2.0.05_1_jp/sample/SampleApp1/assets/live2d/haru/motions/idle_02.mtn",
            "../LIB/Live2D_SDK_WebGL_2.0.05_1_jp/sample/SampleApp1/assets/live2d/haru/motions/tapBody_03.mtn",
            "../LIB/Live2D_SDK_WebGL_2.0.05_1_jp/sample/SampleApp1/assets/live2d/haru/motions/tapBody_02.mtn"
        ],
        "sounds" : [
            "../LIB/Live2D_SDK_WebGL_2.0.05_1_jp/sample/SampleApp1/assets/live2d/haru/sounds/tapBody_02.mp3"
        ]
    };
    
    
    // Live2Dの初期化
    Live2D.init();
    

    // canvasオブジェクトを取得
	var canvas = document.getElementById("glcanvas");

	// コンテキストを失ったとき
    
	canvas.addEventListener("webglcontextlost", function (e) {
        Simple.myerror("context lost");
        loadLive2DCompleted = false;
        initLive2DCompleted = false;
        
        var cancelAnimationFrame =
            window.cancelAnimationFrame ||
            window.mozCancelAnimationFrame;
        cancelAnimationFrame(requestID); //アニメーションを停止
        
        e.preventDefault();
    }, false);
    
    // コンテキストが復元されたとき
	canvas.addEventListener("webglcontextrestored" , function (e) {
        Simple.myerror("webglcontext restored");
        Simple.initLoop(canvas); 
    }, false);

	// Init and start Loop
	Simple.initLoop(canvas);
};


/*
* WebGLコンテキストを取得・初期化。
* Live2Dの初期化、描画ループを開始。
*/
Simple.initLoop = function (canvas/*HTML5 canvasオブジェクト*/) {
    //------------ WebGLの初期化 ------------
    
	// WebGLのコンテキストを取得する
    var para = {
        premultipliedAlpha : true//,
//        alpha : false
    };
	var gl = Simple.getWebGLContext(canvas, para);
	if (!gl) {
        Simple.myerror("Failed to create WebGL context.");
        return;
    }

	// 描画エリアを白でクリア
	gl.clearColor( 0.0 , 0.0 , 0.0 , 0.0 ); 

    //------------ Live2Dの初期化 ------------
    
	// mocファイルからLive2Dモデルのインスタンスを生成
	Simple.loadBytes(modelDef.model, function (buf){
		live2DModel = Live2DModelWebGL.loadModel(buf);
	});

	// テクスチャの読み込み
    var loadCount = 0;
	for(var i = 0; i < modelDef.textures.length; i++){
		(function ( tno ){// 即時関数で i の値を tno に固定する（onerror用)
			loadedImages[tno] = new Image();
			loadedImages[tno].src = modelDef.textures[tno];
			loadedImages[tno].onload = function(){
				if((++loadCount) == modelDef.textures.length) {
                    loadLive2DCompleted = true;//全て読み終わった
                }
			};
			loadedImages[tno].onerror = function() { 
				Simple.myerror("Failed to load image : " + modelDef.textures[tno]); 
			};
		})( i );
	}
    
	// モーションの読み込み
    for(var j = 0; j < modelDef.motions.length; j++){
        Simple.loadBytes(modelDef.motions[j], function(buf){
            motions.push(new Live2DMotion.loadMotion(buf));
        });
    }
    motionMgr = new L2DMotionManager();

    // サウンドの読み込み
    for(var k = 0; k < modelDef.sounds.length; k++){
        sounds.push(new Sound(modelDef.sounds[k]));
    }
    //------------ 描画ループ ------------

    (function tick() {
        Simple.draw(gl); // 1回分描画
        
        var requestAnimationFrame = 
            window.requestAnimationFrame || 
            window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame || 
            window.msRequestAnimationFrame;
		requestID = requestAnimationFrame( tick , canvas );// 一定時間後に自身を呼び出す
    })();
};


Simple.draw = function(gl/*WebGLコンテキスト*/)
{
	// Canvasをクリアする
	gl.clear(gl.COLOR_BUFFER_BIT);
    
	// Live2D初期化
	if( ! live2DModel || ! loadLive2DCompleted ) 
        return; //ロードが完了していないので何もしないで返る
	
	// ロード完了後に初回のみ初期化する
	if( ! initLive2DCompleted ){
		initLive2DCompleted = true;

        // 画像からWebGLテクスチャを生成し、モデルに登録
        for( var i = 0; i < loadedImages.length; i++ ){
            //Image型オブジェクトからテクスチャを生成
            var texName = Simple.createTexture(gl, loadedImages[i]);
            
            live2DModel.setTexture(i, texName); //モデルにテクスチャをセット
        }

        // テクスチャの元画像の参照をクリア
        loadedImages = null;

        // OpenGLのコンテキストをセット
        live2DModel.setGL(gl);

        // 表示位置を指定するための行列を定義する
        var s = 2.0 / live2DModel.getCanvasWidth(); //canvasの横幅を-1..1区間に収める
        var matrix4x4 = [ s,0,0,0 , 0,-s,0,0 , 0,0,1,0 , -1.0,1,0,1 ];
        live2DModel.setMatrix(matrix4x4);
	}
    
	// モーションが終了 または アイドルモーション以外ならモーション再生
    if(motionMgr.isFinished() || motionnm != 0){
        // モーションの再生
        motionMgr.startMotion(motions[motionnm]);
        // 前回のサウンド0停止
        this.SoundStop(0);
        switch(motionnm){
            case 2: //モーション2の場合
                this.SoundPlay(0); // サウンド0再生
                break;
        }
        this.isIdle = (motionnm == 0);
        motionnm = 0;
    }
    // モーションマネジャーの更新
    motionMgr.updateParam(live2DModel);
    
    // キャラクターのパラメータを適当に更新
    var t = UtSystem.getTimeMSec() * 0.001 * 2 * Math.PI; //1秒ごとに2π(1周期)増える
    var cycle = 3.0; //パラメータが一周する時間(秒)
    // PARAM_ANGLE_Xのパラメータが[cycle]秒ごとに-30から30まで変化する
    //live2DModel.setParamFloat("PARAM_ANGLE_X", 30 * Math.sin(t/cycle));
    
    
    if(this.isIdle){
        live2DModel.setParamFloat("PARAM_ANGLE_X", 40 * (mousePos.x - 0.5));
        live2DModel.setParamFloat("PARAM_ANGLE_Y", 40 * (0.5 - mousePos.y));
        live2DModel.setParamFloat("PARAM_EYE_BALL_X", mousePos.x - 0.5);
        live2DModel.setParamFloat("PARAM_EYE_BALL_Y", 0.5 - mousePos.y);
    }    
    
    // Live2Dモデルを更新して描画
    live2DModel.update(); // 現在のパラメータに合わせて頂点等を計算
    live2DModel.draw();	// 描画
};


/*
* WebGLのコンテキストを取得する
*/
Simple.getWebGLContext = function(canvas/*HTML5 canvasオブジェクト*/)
{
	var NAMES = [ "webgl" , "experimental-webgl" , "webkit-3d" , "moz-webgl"];
	
    var param = {
        alpha : true,
        premultipliedAlpha : true
    };
    
	for( var i = 0; i < NAMES.length; i++ ){
		try{
			var ctx = canvas.getContext( NAMES[i], param );
			if( ctx ) return ctx;
		} 
		catch(e){}
	}
	return null;
};


/*
* Image型オブジェクトからテクスチャを生成
*/
Simple.createTexture = function(gl/*WebGLコンテキスト*/, image/*WebGL Image*/) 
{
	var texture = gl.createTexture(); //テクスチャオブジェクトを作成する
	if ( !texture ){
        mylog("Failed to generate gl texture name.");
        return -1;
    }
    
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);	//imageを上下反転
	gl.activeTexture( gl.TEXTURE0 );
	gl.bindTexture( gl.TEXTURE_2D , texture );
	gl.texImage2D( gl.TEXTURE_2D , 0 , gl.RGBA , gl.RGBA , gl.UNSIGNED_BYTE , image);
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    
    
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture( gl.TEXTURE_2D , null );
    
	return texture;
};


/*
* ファイルをバイト配列としてロードする
*/
Simple.loadBytes = function(path , callback)
{
	var request = new XMLHttpRequest();
	request.open("GET", path , true);
	request.responseType = "arraybuffer";
	request.onload = function(){
		switch( request.status ){
		case 200:
			callback( request.response );
			break;
		default:
			Simple.myerror( "Failed to load (" + request.status + ") : " + path );
			break;
		}
	}
    
    request.send(null); 
};


/*
* 画面ログを出力
*/
Simple.mylog = function(msg/*string*/)
{
	var myconsole = document.getElementById("myconsole");
	myconsole.innerHTML = myconsole.innerHTML + "<br>" + msg;
	console.log(msg);
};

/*
* 画面エラーを出力
*/
Simple.myerror = function(msg/*string*/)
{
    console.error(msg);
	Simple.mylog( "<span style='color:red'>" + msg + "</span>");
};

/*
 * モーション切り替え
 */
Simple.motionChange = function(num){
    motionnm = num;
}

/**
* サウンド管理クラス
*/
var Sound = function (path) {
    this.snd = document.createElement("audio");
    this.snd.src = path;
};
/*
 * サウンド再生
 */
Simple.SoundPlay = function(num){
    sounds[num].snd.play();
}
/*
 * サウンド停止
 */
Simple.SoundStop = function(num){
    // サウンドが再生中ならとめる
    if(sounds[num].snd.paused == false){
        sounds[num].snd.pause();
        sounds[num].snd.currentTime = 0;
    }
}