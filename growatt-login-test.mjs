<html data-name="login"><head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, user-scalable=no,initial-scale=1.0,maximum-scale=1.0,minimum-scale=1.0">
    <title>Login</title>
    <link rel="stylesheet" type="text/css" href="/css/xhb/common.css?1.8.3">

    <link rel="shortcut icon" type="image/x-icon" href="/v3//images/favicon/favicon.ico">
    <link rel="stylesheet" type="text/css" href="/v3/css/common/base.css?1.8.3">
    <link rel="stylesheet" type="text/css" href="/v3/js/common/layui-v2.2.5/css/layui.css">
    <link rel="stylesheet" type="text/css" href="/v3/css/odm/odm.css?1.8.3">
    <link rel="stylesheet" type="text/css" href="/v3/css/odm/odm_en.css?1.8.3">

    <link rel="stylesheet" type="text/css" href="/v3/css/login/login.css?1.8.3">
    <link rel="stylesheet" type="text/css" href="https://g.alicdn.com/tb-page/ali-page-updater/0.0.16/index-min.css">
    <script>
        var areaListLang = [
            {txt:'China'},//中国
            {txt:'USA / Canada'},//美国&加拿大
            {txt:'Other Regions'},//其他地区
            {txt:'Australia'},//澳洲
        ];
    </script>
    <script src="/javaScript/xhb/js/MD5.js?1.8.3" type="text/javascript" charset="utf-8"></script>
    <script src="/javaScript/serverHostnameList.js?1.8.3" type="text/javascript" charset="utf-8"></script>
    <script src="/javaScript/xhb/js/langConfig.js?1.8.3" type="text/javascript" charset="utf-8"></script>
    <script>
        var ODMPARAM={};
        var LANG='en';
        var i18n_common_regValue="Value";//值
        var i18n_carry_out="Finish";//保存
        var push_select="Please Select";//请选择
        var LANGS;
        var odmpg='_en';
        var requestData = {};
    </script>
<link id="layuicss-laydate" rel="stylesheet" href="https://server.growatt.com/v3/js/common/layui-v2.2.5/css/modules/laydate/default/laydate.css?v=5.0.9" media="all"><link id="layuicss-layer" rel="stylesheet" href="https://server.growatt.com/v3/js/common/layui-v2.2.5/css/modules/layer/default/layer.css?v=3.1.1" media="all"><link id="layuicss-skincodecss" rel="stylesheet" href="https://server.growatt.com/v3/js/common/layui-v2.2.5/css/modules/code.css" media="all"></head>
<body id="body" class="writebg">
	
	<div class="loginTop mylogin">
		<div class="loginHeader clearBox">
			<a class="floatL loginL"><img src="/v3/images/login/logo.png"></a>
			
			<ul class="loginMenu floatR clearBox">
			
				<li><a href="http://shinedesign.growatt.com/ShineDesign" target="_blank" style="color:#FFF">Shinedesign</a></li>
			
				<li><a href="/login/download" style="color:#FFF">Download</a></li>
				<li class="mobile_end">Mobile End<img src="/images/download_growatt.png" width="160"></li>
				<li class="menuLang">
					<span>Language</span>
					<!--{--><div class="langBox">
					<a onclick="javascript:changeLang('cn')">中文</a><a onclick="javascript:changeLang('hk')">繁體中文</a><a onclick="javascript:changeLang('en')" class="active">English</a><a onclick="javascript:changeLang('fr')">Français</a><a onclick="javascript:changeLang('gk')">Greek</a><a onclick="javascript:changeLang('gm')">German</a><a onclick="javascript:changeLang('ho')">Nederland</a><a onclick="javascript:changeLang('it')">Italiano</a><a onclick="javascript:changeLang('ja')">日本語</a><a onclick="javascript:changeLang('pl')">Polish</a><a onclick="javascript:changeLang('pt')">Português</a><a onclick="javascript:changeLang('sp')">Español</a><a onclick="javascript:changeLang('tk')">Türkçe</a><a onclick="javascript:changeLang('vn')">Tiếng Việt</a><a onclick="javascript:changeLang('kr')">한국어</a><a onclick="javascript:changeLang('th')">ไทย</a><a onclick="javascript:changeLang('jk')">Česky</a><a onclick="javascript:changeLang('lmny')">Română</a></div><!--}-->
				</li>
				
			</ul>
			<div class="toogleMenue">
				<span></span>
				<span></span>
				<span></span>
			</div>
			<ul class="minNav">
				<li><a href="http://shinedesign.growatt.com/ShineDesign" target="_blank">Shinedesign</a></li>
				<li><a href="/login/download">Download</a></li>
				<li><a class="login_help_download" target="_blank" href="https://cdn.growatt.com/user_manual_file/ShineServer_user_manual_EN_V3.0.pdf">Help</a></li>
				<li><a href="jsp/help/version_notes.jsp">Update Log</a></li>
				<li class="minMenuLang">
					<span>Language</span>
					<!--{--><div class="minLangBox">
					<a onclick="javascript:changeLang('cn')">中文</a><a onclick="javascript:changeLang('hk')">繁體中文</a><a onclick="javascript:changeLang('en')" class="active">English</a><a onclick="javascript:changeLang('fr')">Français</a><a onclick="javascript:changeLang('gk')">Greek</a><a onclick="javascript:changeLang('gm')">German</a><a onclick="javascript:changeLang('ho')">Nederland</a><a onclick="javascript:changeLang('it')">Italiano</a><a onclick="javascript:changeLang('ja')">日本語</a><a onclick="javascript:changeLang('pl')">Polish</a><a onclick="javascript:changeLang('pt')">Português</a><a onclick="javascript:changeLang('sp')">Español</a><a onclick="javascript:changeLang('tk')">Türkçe</a><a onclick="javascript:changeLang('vn')">Tiếng Việt</a><a onclick="javascript:changeLang('kr')">한국어</a><a onclick="javascript:changeLang('th')">ไทย</a><a onclick="javascript:changeLang('jk')">Česky</a><a onclick="javascript:changeLang('lmny')">Română</a></div><!--}-->
				</li>
				<li class="exper loginView"><a href="/login/toViewExamlePlant">Experience</a></li>
			</ul>
		</div>
		<!--登录框-->
		<div class="loginContent clearBox">
			<div class="loginBanner floatL">
				
				
				
				
				
			</div>
			<div class="loginA">
				<div class="bank1"></div>
				<div class="bank2"></div>
				<div class="bank3"></div>
				<div class="bank4"></div>
				<div class="bank5"></div>
				<div class="yuan yuan1"></div>
				<div class="yuan yuan2"></div>
				<div class="yuan yuan3"></div>
				<div class="bank6"></div>
				<div class="bank7"></div>
				<div class="bank8"></div>
				<div class="bank9"></div>
				<div class="bank10"></div>
				<div class="bank11"></div>
				<div class="bank12"></div>
				<div class="bank13"></div>
				<div class="bank14"></div>
				<div class="bank15"></div>
			</div>
			<div class="loginbg2" id="loginAnimotion"><canvas width="0" height="0" style="width: 100%; height: 100%; transform-origin: 0px 0px 0px;"></canvas></div>
			<div class="loginBox floatL">
				<div class="loginPro" data-scroll-reveal="enter right and move 50px over 1s" data-scroll-reveal-id="1" data-scroll-reveal-initialized="true" data-scroll-reveal-complete="true">
					<div class="loginPro-title"><span class="none loginMon">Login</span><span class="none loginOSS" style="display: inline;">Monitor/Oss Login</span></div>
					<div class="loginPro-box">
						<div class="clearBox">
							<a href="/register" class="ftHoverColor ftFirst floatR" style="margin-right:35px;color:#777777;">Register an Account</a>
						</div>
						<div class="sameLogin-row clearBox" style="position: relative;">
							<input autocomplete="username" name="username" id="val_loginAccount" type="text" class="sameLogin userNameVal" placeholder="User Name" maxlength="50">
							<i class="arrows_x"></i>
							<i class="userBg"></i>
						<div class="savedAccountsList" style="display: none;"></div></div>
						<div class="sameLogin-row clearBox">
							
							
							<input autocomplete="current-password" name="password" id="val_loginPwd" type="password" class="sameLogin pasdVal" placeholder="Password" maxlength="40">
							
							<i class="isshowtext"></i>
							<i class="pasdBg"></i>
						</div>
						<div class="sameLogin-row clearBox sameLogin-Code" style="display:none !important;">
							<input autocomplete="off" id="val_loginValidCode" type="text" class="loginV checkVal" placeholder="Verification Code" maxlength="3">
							<img id="img_loginValidCode" style="cursor:pointer;" src="/getValidateCode.do">
						</div>
						<div class="forgetPasd layui-form">
							<div class="laypassword">
								<input autocomplete="off" type="checkbox" class="remember" name="" title="Save Password" lay-skin="primary"><div class="layui-unselect layui-form-checkbox" lay-skin="primary"><span>Save Password</span><i class="layui-icon"></i></div>
							</div>
							<a href="/login/findPwd" class="ftHoverColor">Forget Password</a>
						</div>
						<div class="loginBtn">
							<button class="hasColorBtn loginB">Login</button>
						</div>
						
						<div class="loginBtntwo" style="display: none;">
							<a href="/register" class="ftHoverColor">Register an Account</a>
						</div>
						<div class="registUser">
							<a href="/login/toViewExamlePlant" class="ftColor">Demo Account</a>
							<a class="ftColor iotJump">iot Vulnerability Disclosure</a>
						</div>
					</div>
					


				</div>
			</div>
		</div>
	</div>
		<!--示例电站-->
		<div class="fxPlant">
			<div class="fx-title sameBd">Demo Account</div>
			<div class="fxImg clearBox">
				<div class="curryData" data-scroll-reveal="enter top and move 50px over 1s" data-scroll-reveal-id="2" data-scroll-reveal-initialized="true" data-scroll-reveal-complete="true">
					<div></div>
					<p>Current Data</p>
				</div>
				<div class="historyChart" data-scroll-reveal="enter bottom and move 50px over 1s" data-scroll-reveal-id="3" data-scroll-reveal-initialized="true" data-scroll-reveal-complete="true">
					<div></div>
					<p>History Chart</p>
				</div>
				<div class="fxClear"></div><!--这个元素不能去掉-->
				<div class="plantData" data-scroll-reveal="enter top and move 50px over 1s" data-scroll-reveal-id="4" data-scroll-reveal-initialized="true" data-scroll-reveal-complete="true">
					<div></div>
					<p>Plant Data</p>
				</div>
				<div class="plantMsa" data-scroll-reveal="enter bottom and move 50px over 1s" data-scroll-reveal-id="5" data-scroll-reveal-initialized="true" data-scroll-reveal-complete="true">
					<div></div>
					<p>Plant Analysis</p>
				</div>
			</div>
			<div class="fxBtn">
				<a href="/login/toViewExamlePlant" class="commonBtn loginView bdColorTwo" style="height: auto;padding: 2px 35px;">Experience Now</a>
			</div>
		</div>
		<!--客户案例-->
		<div class="customerCase">
			<div class="fx-title sameBd">Customer Cases</div>
			<div class="cc-img clearBox">
			<div class="sameCS-con"><div class="sameCS"><div class="sameCs_img"><img width="100%" src="/v3/images/default_map_g.png"></div><div class="sameCs_text"><p><span title="Thu***s">Thu***s</span><i class="lxColor">Offline<!-- 离线 --></i></p><p>Doc********************************************d</p></div><table><tbody><tr><td><p>1080</p><p>PV Total Capacity</p></td><td><p>0</p><p>Generation Today</p></td><td><p>9006.9</p><p>Total Generation</p></td></tr></tbody></table></div><div class="sameCS"><div class="sameCs_img"><img width="100%" src="/v3/images/default_map_g.png"></div><div class="sameCs_text"><p><span title="320****1">320****1</span><i class="lxColor">Offline<!-- 离线 --></i></p><p>Zui******************** </p></div><table><tbody><tr><td><p>1000</p><p>PV Total Capacity</p></td><td><p>0</p><p>Generation Today</p></td><td><p>8217.3</p><p>Total Generation</p></td></tr></tbody></table></div><div class="sameCS"><div class="sameCs_img"><img width="100%" src="/v3/images/default_map_y.png"></div><div class="sameCs_text"><p><span title="Lis****e">Lis****e</span><i class="lxColor">Offline<!-- 离线 --></i></p><p></p></div><table><tbody><tr><td><p>2000</p><p>PV Total Capacity</p></td><td><p>0</p><p>Generation Today</p></td><td><p>18579.9</p><p>Total Generation</p></td></tr></tbody></table></div><div class="sameCS"><div class="sameCs_img"><img width="100%" src="/v3/images/default_map_g.png"></div><div class="sameCs_text"><p><span title="Gro************r">Gro************r</span><i class="lxColor">Offline<!-- 离线 --></i></p><p>26 **************e</p></div><table><tbody><tr><td><p>4500</p><p>PV Total Capacity</p></td><td><p>0</p><p>Generation Today</p></td><td><p>2.9</p><p>Total Generation</p></td></tr></tbody></table></div></div></div>
			<div class="fxBtn">
				<button class="commonBtn bdColorTwo commonBtnMore">View More</button>
			</div>
		</div>
		<!--通知-->
		
		<!--客户端下载-->
		
			<div class="clinBox odm_th_hide">
				<div class="fx-title sameBd">Download App</div>
				<div class="clDowlond clearBox">
					<div class="phoneImg"></div>
	
					<div class="dowText">
						<!-- 顶部app -->
						<div class="top">
							<div class="app_logo">
								<img style="border-radius: 10px;" src="/v3/images/shinephone_app.png" alt="">
							</div>
							<div class="title_1">
								<p><a href="http://server.growatt.com:80/app/xml/download_growatt.png.jsp" style="color: #ffffff !important;">ShinePhone APP</a></p>
								<p>
									<span>Total Generation
										<img src="/v3/images/dagou.png" alt="">
									</span>
                            <span>Solar Revenue
											<img src="/v3/images/dagou.png" alt="">
									</span>
                            <span>Device Status
											<img src="/v3/images/dagou.png" alt="">
									</span>
                        </p>
                    </div>
                </div>
                <!-- 底部app二维码下载 -->
                <div class="bottom">
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                    <div class="downloadBox" style="background-image: url(&quot;/images/download_growatt.png&quot;);">
                        <p>Scan QR Code to Download</p>
                    </div>
                </div>

            </div>
        </div>
    </div>

<!--底部-->
<div class="loginFooter clearBox odm_th_hide">
    <div class="lfLeft" style="position: relative;">
        <p class="odmText" data-odm-t="copyRightText" style="float: left;">
            Copyright©2022 -
            
                
                
                    SHENZHEN GROWATT NEW ENERGY Co., Ltd ShineServer-3.6.9.0
                
            
        </p>
        <a id="loginTerms" href="/userTerms/termsOfUse_en.html" target="_blank" style="line-height: 60px;color: #0a7ee4;display: inline-block;margin-left: 20px;">Privacy Policy</a>
        <a id="beian" href="http://beian.miit.gov.cn/" target="_blank" rel="external nofollow" style="line-height: 60px;color: #cccccc;margin-left: 20px;display:none;">粤ICP备2020086496号</a>
    </div>
    <div class="lfRight">
        <img class="" src="/v3/images/login/logo.png">
    </div>
</div>
<div class="login_footer odm_th_show" style="display:none;">
    <div class="contact cc-img">
        <p class="footTop">Provincial&nbsp;Power&nbsp;Authority<br>
            200&nbsp;Ngamwongwan&nbsp;Road,&nbsp;Ladyao,&nbsp;Chatuchak&nbsp;Bangkok&nbsp;10900 &nbsp; | &nbsp;
            Tel:<a href="tel:025890100">02-589-0100 to 1</a> | &nbsp;
            <span>Call&nbsp;Center : <a href="tel:1129">1129</a></span> | &nbsp;
            <span>Social</span>:&nbsp;
            <a href="https://www.facebook.com/Provincial.Electricity.Authority" target="_blank" alt="facebook" class="icon fa-facebook"></a>
            <a href="https://twitter.com/pea_thailand" target="_blank" alt="twitter" class="icon fa-twitter"></a>
            <a href="https://www.youtube.com/user/PEAchannelThailand" target="_blank" alt="youtube" class="icon fa-youtube"></a>
            <a href="https://instagram.com/peathailand/" target="_blank" alt="instagram" class="icon fa-instagram"></a>
        </p>
        <p class="footBottom">@Copyright&nbsp;2020&nbsp;by&nbsp;Provincial&nbsp;Electricity&nbsp;Authority</p>
    </div>
</div>
<!-- 返回顶部 -->
<div class="fanhui">
    <img src="/v3/images/newfanhui.jpg" alt="">
</div>
<!--{-->
<div class="UCTips" id="UCTips">
    <div class="container">
        <div class="UCclose"></div>
        <h1>
            <span><i class="sprite warn"></i><em lang-zh="温馨提醒：您当前的浏览器版本过低，存在安全风险，建议升级浏览器" lang-en="Your browser is out-of-date. Please download one of the up-to-date, free and excellent browsers for better security, speed and comfort.">温馨提醒：您当前的浏览器版本过低，存在安全风险，建议升级浏览器</em></span>
        </h1>
        <div class="box pc-box">
					<span class="box-title">
						<i class="sprite pc"></i>
						<b lang-zh="浏览器升级推荐" lang-en="browsers for pc">浏览器升级推荐</b>
						<em class="arrow"></em>
					</span>
            <ul>
                <li class="chrome-item">
                    <i class="sprite chrome"></i>
                    <p lang-zh="推荐选择" lang-en="Recommended Choice">推荐选择</p>
                    <a id="chrome" target="_blank" href-en="https://www.google.com/intl/en/chrome/browser/desktop/" href-zh="https://www.google.cn/intl/zh-CN/chrome/browser/desktop/" href="https://www.google.cn/intl/zh-CN/chrome/browser/desktop/" data-spm-click="gostr=/updater;locaid=d1;name=google">
                        <b lang-zh="谷歌浏览器" lang-en="Chrome">谷歌浏览器</b>
                        <em></em>
                        <i></i>
                    </a>
                </li>
                <li class="seperator"></li>
                <li class="ff-item">
                    <i class="sprite ff"></i>
                    <p lang-zh="推荐选择" lang-en="Recommended Choice">推荐选择</p>
                    <a target="_blank" href="http://www.mozilla.com/firefox/" data-spm-click="gostr=/updater;locaid=d2;name=firefox">
                        <b lang-zh="火狐浏览器" lang-en="FireFox">火狐浏览器</b>
                        <em></em>
                        <i></i>
                    </a>
                </li>
                <li class="seperator"></li>
                <li class="uc-item">
                    <i class="sprite uc"></i>
                    <p lang-zh="新锐用户选择" lang-en="Recommended Choice">推荐选择</p>
                    <a id="uc" target="_blank" href-zh="http://www.uc.cn/ucbrowser/download/" href-en="http://www.ucweb.com/ucbrowser/download/" href="http://www.uc.cn/ucbrowser/download/" data-spm-click="gostr=/updater;locaid=d3;name=uc">
                        <b lang-zh="UC浏览器" lang-en="UC browser">UC浏览器</b>
                        <em></em>
                        <i></i>
                    </a>
                </li>
            </ul>
        </div>
    </div>
</div>
<div class="cookies_tip">
    <span>Our website uses cookies provided by us and in part from Google Chrome. Cookies are necessary for the operation of the website and by continuing of usemeans that you agree to the use the cookies.<!-- 我们的网站使用由我们以及部分从Google浏览器提供的 cookies。cookies是网站运营所必需的，继续使用即表示您同意使用cookies。 --></span>
    <button class="tip_btn">Agree</button>
</div>
<div id="ysxy_dialog" style="display:none">
    <h3>Privacy policy update<!-- 隐私政策更新 --></h3>
    <p>Dear Users, Hello:<!-- 尊敬的用户您好: --></p>
    <div class="ysxy_mainInner"></div>
    <div class="ysxy_btn"><span class="ysxy_Agree">Read and Agree<!-- 已阅读并同意 --></span><span class="ysxy_Quit">Disagree&nbsp; and&nbsp; Quit</span></div>
</div>
<!--}-->










<script src="/javaScript/js/vue.min.js" type="text/javascript" charset="utf-8"></script>
<!-- 
分区提示弹层组件
 -->
 <style>
 	.markBox {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: 100000000;
    background: rgba(0,0,0,0.8);
    display: flex;
	align-items: center;
	justify-content: center;
	
}
.markBoxHide.markBox{display:none;}
.fenquLayer{width:600px;background: #fff;  border-radius: 10px;}
.fenquLayerTitleSub{color: gray;}
.chooseSiteListBox ul{
	    border: 1px solid #ddd;
    width: 70%;
    margin: 0 auto;
}
.chooseSiteListBox ul li{
	border-bottom: 1px solid #ddd;
    line-height: 35px;
        cursor: pointer;
}
body .chooseSiteListBox ul li.on{
	color: #ddd;
    cursor: no-drop;
    background: none;
}
.chooseSiteListBox ul li:hover{
    cursor: pointer;
    background: #b3e2ff;
    color: #009cff;
}
.chooseSiteListBox ul li.active{
    cursor: pointer;
    background: #b3e2ff;
    color: #009cff;
}
.chooseSiteListBox ul li:last-child{
	border-bottom:none;
}
.fenquLayerBtnBox{
	width: 70%;
    margin: 0 auto;
    margin-top: 30px;
}
.fenquLayerBtnBox button{
	width: 100%;
    line-height: 45px;
    background: #f6f3f7;
    box-shadow: none;
    border: none;
    border-radius: 30px;
    color: #aaa7aa;
    cursor: no-drop;
}
.fenquLayerBtnBox button.active{
	background: #009cff;
    color: #afe9bf;
    cursor: pointer;
}
.fenquLayerBtnBox button.active:hover{opacity: 0.8;}
.fenquLayerNotice{
	width:500px;background: #fff;  border-radius: 10px;	height: auto;
}
.fenquLayerNotice_qunaBox {
    width: 124px;
    height: 124px;
    margin: 0 auto;
    position: relative;
    margin-top: 15px;
    margin-bottom: 35px;
}
#fenquLayerNotice_quna{
	 width: 100%;
    height: 100%;
}
.fenquLayerNotice_hostname {
    font-size: 16px;
    margin-top: 10px;
    margin-bottom: 30px;
    color: #009cff;
}
.fenquLayerNotice_content_2 {
    color: #c9c9c9;
    margin-top: 15px;
}
.fenquLayerNotice_quna_txt {
    position: absolute;
    left: 50%;
    margin-left: -16px;
    top: 58%;
    color: #dedede
}
.updateNoticeLayer{
	width:800px;background: #fff;  border-radius: 10px;
}
.sys_blue_c{color:#009cff;}
  .sys_color{color:#009cff;}
  .yc_notice_btnBox button{
			background: #fff;  
			border-radius: 20px;
			text-align: center;
    line-height: 40px;
    padding: 0;
    width: 128px;	
    		border: none;
		} 
		#yc_notice_close{
			background: #c9c9c9;  
		}
		#yc_notice_cancel{
			background: #009cff;
			color:#fff;
		}
 </style>
<div id="fenquLayer" class="markBox" style="display: none;"><div class="text-c fenquLayer sys_layer pd-30" style="display: none;"><div class="fs-18">Tips</div> <div class="fs-14 mt-20 mb-20 fenquLayerTitleSub">
			Tip: It is detected that the account contains multiple sites, please select the corresponding site to log in
		</div> <div class="chooseSiteListBox"><ul class="text-c"><li class="">China</li><li class="">USA / Canada</li><li class="">Other Regions</li><li class="">Australia</li><li class="">日本</li></ul></div> <div class="fenquLayerBtnBox"><button type="button" class="fenquLayerBtn">Yes</button></div></div> <div class="pd-30 updateNoticeLayer"><div class="pl-10 pr-10"><div class="fs-20">Change Notification</div> <div class="fs-14 mt-10"><p>
					In order to strengthen the protection of your personal information, we have updated the privacy policy in accordance with the latest laws and regulations. Please be sure to read and fully understand the terms and conditions before clicking "Agree".
					</p> <p>For details, please see the latest <a href="/userTerms/termsOfUse_cn_new.pdf" target="_blank" class="sys_blue_c">《User Agreement》</a> <a href="/userTerms/termsOfYinsi_cn_new.pdf" target="_blank" class="sys_blue_c">《Privacy Policy》</a> <a href="/userTerms/termsOfUse_zh_cn3.html" target="_blank" class="sys_blue_c">《Detailed Description》</a></p></div> <div class="fs-20 mt-20">
				The revised privacy policy terms mainly include the following aspects:</div> <div class="fs-14 mt-10"><p>（1） The purpose of processing the personal information;</p> <p>（2） Types and scenarios of processing personal information;</p> <p>（3） Types, specific content and channels of personal information rights;</p> <p>（4） Entrusted processing and sharing of personal information between us and third parties;</p> <p>（5） The registered name of the personal information processor was changed to Shenzhen Growatt New Energy Co., Ltd. (formerly known as Shenzhen Great New Energy Co., Ltd.).</p></div> <div class="fs-14 mt-30" style="color: rgb(231, 73, 24);">
				If you agree to the above terms, please click the "Agree" button to start accepting our services; if you do not agree to the above agreement or any of its terms, it may affect your use of our related services.
				</div> <div class="flex_space-around yc_notice_btnBox mt-30"><button type="button" id="yc_notice_close">Cancel</button> <button type="button" id="yc_notice_cancel">Agree</button></div></div></div></div>

<script>
var updateNotice = new Vue({
			el:"#fenquLayer",
			data:{				
				isHideMask:true,//是否隐藏大的遮罩层
				sureChooseBtnActive:false,//是否激活确定选择按钮				
				areaList:serverHostnameList,
				serverStatus:3,//1，检测到账号包含多个站点；2，检测到该账户所属域名地址（检测您所选国家域名）；变更通知是3
				checkStatus:1,//1,检测域名，2检测国家
				currHostname:'https://server-cn.growatt.com',//当前域名
				newHostname:'https://server.growatt.com',//当前域名
				fenquContent:"Tip: It is detected that the account contains multiple sites, please select the corresponding site to log in", //"提示：检测到账号包含多个站点，请选择对应的站点登录",//分区txt内容
			},
			created:function(){
				
			},
			watch:{
				
			},
			mounted:function(){
				var _this = this;
				
				window.onload = function(){
					document.getElementById('fenquLayer').setAttribute("class","markBox");
				}
				//加载进度条
				//_this.render_xhb_pro_1();
			},
			methods:{
				/**
				渲染倒计时
				@param currHostname  当前域名
				@param newHostname  新域名
				*/
				/* render_xhb_pro_1:function(currHostname,newHostname){
					var _this = this;
					this.currHostname = currHostname;
					this.newHostname = newHostname;
					//调用倒计时组件
					var p1 = new xhb_Progress({
						el: 'fenquLayerNotice_quna', //canvas元素id
						deg: 100, //绘制角度
						timer: 75, //绘制时间,每2.5位1秒
						lineWidth: 8, //线宽
						lineBgColor: '#dedede', //底圆颜色
						lineColor: '#0EC439', //动态圆颜色
						textColor: '#000', //文本颜色
						fontSize: 36, //字体大小
						circleRadius: 50 ,//圆半径
					},function(num){
						//console.log(num,"时间111")
						if(num == 30){
							//alert("即将跳转" + _this.newHostname)
							window.location.href = _this.newHostname;
						}
					});
				}, */
				//确定选取区域
				sureChooseArea:function(){
					var _this = this;
					if(!this.sureChooseBtnActive) return;
					this.isHideMask = true;
					//设置分区标识					
					//requestData.type = 0;
					//把标识带给所选服务器，设置分区标识
					localStorage.setItem("login_type2","0");
					
					
					_this.newHostname = _this.newHostname.replace("/login","");
					
					//自動登錄邏輯
					//login(_this.newHostname);
					
					this.isHideMask = true;
					window.location.href = _this.newHostname + "/login";
				},
				chooseAreaItem:function(v){
					//if(v.on) return;
					for(var i=0;i<this.areaList.length;i++){
						this.areaList[i].active = false;
					}
					v.active = true;
					this.sureChooseBtnActive = true;
					//点击选择新区
					this.newHostname = location.protocol + "//" + v.url;
				},
				backClassByItem:function(v){
					/* if(v.on){
						return "on";
					}else{
						if(v.active){
							return "active";
						}else{
							return "";
						}
					} */
					if(v.active){
						return "active";
					}else{
						return "";
					}
				},
				jumpNow:function(){
					window.location.href = this.newHostname;
				},
				//根据当前域名修改currHostname和areaList
				updateHostname:function(fn){
					var currUrl = window.location.hostname;
					this.currHostname = location.protocol + "//" + currUrl;
					for(var i=0;i<this.areaList.length;i++){
						if(this.areaList[i].url == currUrl){
							this.areaList[i].on = true;
						}else{
							this.areaList[i].on = false;
						}
					}
					fn && fn();
				},
			}
		});
</script>


<input autocomplete="off" type="hidden" id="v3qrCodeImgName" value="download_growatt.png">
<script type="text/javascript" src="/v3/js/common/jquery.min.js?1.8.3"></script>
<script type="text/javascript" src="/javaScript/js/jquery.cookie_i18n.js?1.8.3"></script>
<script type="text/javascript" src="/v3/js/odm/odm.js?1.8.3"></script>
<script type="text/javascript" src="/v3/js/odm/odm_en.js?1.8.3"></script>
<script type="text/javascript" src="/v3/js/common/scrollReveal.js?1.8.3"></script>
<script type="text/javascript" src="/v3/js/common/browser.js?1.8.3"></script>
<script src="/v3/js/common/layui-v2.2.5/layui.all.js?1.8.3"></script>
<script type="text/javascript" src="/v3/js/login/bodymovin.js?1.8.3"></script>

<script type="text/javascript">
    var isMD5Type = true;//是否使用MD5加密密码
    var login_type = localStorage.getItem("login_type2") || 1;//oss分区标识，如有存储传存储值，默认传1

    //同意保护协议
    var isReadPact = 0;
    //取消数据保护协议
    $("#yc_notice_close").on("click",function(){
        updateNotice.$data.isHideMask = true;
    });
    //同意数据保护协议
    $("#yc_notice_cancel").on("click",function(){

        updateNotice.$data.isHideMask = true;
        isReadPact = 1;
        //重新登录
        login();

    });


    var LANG_MAP = oLangConfig.LANG_MAP;
    var systemLanguages = ["cn","hk","en","fr","gk","gm","ho","it","ja","pl","pt","sp","tk","vn","kr","th","jk","lmny"];//["cn","en"]
    if(ODMPARAM["dateforeign"]){
        LANGS="en";
        if($.cookie("lang")!=undefined){
            LANGS=$.cookie("lang");
        }
    }
    $(".downloadBox").css("background-image","url(/images/"+$("#v3qrCodeImgName").val()+")");
    if(ODMPARAM["codeEWtext"]){//后期去掉
        $(".downloadBox>p").text("Stay Tuned")
    }
    if((navigator.appName == "Microsoft Internet Explorer" && navigator.appVersion.match(/7./i)=="7.") || (navigator.appName == "Microsoft Internet Explorer" && navigator.appVersion.match(/8./i)=="8."))
    {
        $("#UCTips").show();
        $(".UCclose").click(function(){
            $("#UCTips").hide();
        })
    }
    var currLang='en';
    var url = window.location.href.toLowerCase();
    layui.use(['layer'], function(){})
    var form = layui.form;
    var layer = layui.layer;
    $("#val_loginAccount").focus();
    checkShowLogin();
    var agreeHtml='termsOfUse_en.html';
    var loginTermtext="Privacy Policy";
    if(currLang=='cn'){
        agreeHtml='termsOfUse_zh_cn.html';
        loginTermtext="隐私条例";
    }else if(currLang=='pl')
        agreeHtml="termsOfUse_pl.html";
    if(ODMPARAM["termsOfUse"])
        agreeHtml=ODMPARAM["termsOfUse"]();
    $("#loginTerms").attr('href', '/userTerms/'+agreeHtml);
    $("#loginTerms").text(loginTermtext);
if(currLang==="sp"){ // 西班牙语 替换登录按钮
	$(".hasColorBtn").html("Login");
}

    $(function(){

        //iot漏洞信息跳转
        $(".iotJump").bind('click',function(){
            window.open("https://"+ODMPARAM["ossUrl"]+"/common/loopholeShow")
        })

// 	localStorage.removeItem("loginbool");
	if('en'!=$.cookie("lang")){
		$.cookie("lang",'en')
	}
	if($.cookie("isloginValidCode")){
		$(".sameLogin-Code").show()
	}
	$(".odmText").text(ODMPARAM['copyRightText']($(".odmText")));
	$.each(systemLanguages,function(v,k){
		var okey="'"+k+"'";
		if(LANG==k){
			$(".langBox").append('<a onclick="javascript:changeLang('+okey+')" class="active">'+LANG_MAP[k]+'</a>')
			$(".minLangBox").append('<a onclick="javascript:changeLang('+okey+')" class="active">'+LANG_MAP[k]+'</a>')
		}else{
			$(".langBox").append('<a onclick="javascript:changeLang('+okey+')">'+LANG_MAP[k]+'</a>')
			$(".minLangBox").append('<a onclick="javascript:changeLang('+okey+')">'+LANG_MAP[k]+'</a>')
		}
	})
	$(function(){
		if(currLang=="cn"||currLang=="hk"){//帮助文档下载
			$(".login_help_download").attr("href",location.protocol+"//cdn.growatt.com/user_manual_file/ShineServer_user_manual_CN_V3.0.pdf");
		}else{
			$(".login_help_download").attr("href",location.protocol+"//cdn.growatt.com/user_manual_file/ShineServer_user_manual_EN_V3.0.pdf");
		}
		setTimeout(function(){
			let paths='';
			if(odmpg=="_th" || odmpg=="_ny"){
				paths='/v3/js/login/data'+odmpg+'.json';
			}else{
				paths='/v3/js/login/data.json';
			}
			bodymovin.loadAnimation({
				path:paths,   //json文件路径
				loop:true,
				autoplay:true,
				renderer:'canvas',  //渲染方式，有"html"、"canvas"和"svg"三种
				container:document.getElementById('loginAnimotion')
			});
			//页面动画
		},100)

		window.scrollReveal = new scrollReveal();
		if($.cookie('pwd')!=undefined){
			$("#val_loginAccount").val($.cookie("acu"));
			$("#val_loginPwd").val($.cookie("pwd"));
			// 记住密码 默认不勾选
			$(".remember").prop('checked', false);
			form.render();
		}
	})
	$(".fanhui").click(function(){
		$('body,html').animate({scrollTop:0},300)
	})
	$(window).scroll(function () {
		var scrollTop = $(window).scrollTop();
		var $windowHeight = $(window).innerHeight();
		scrollTop > $windowHeight ? $(".fanhui").fadeIn(200).css("display","block") : $(".fanhui").fadeOut(200);
	});
	$("#val_loginPwd").on("input propertychange",function(){
		if($(this).val()!=""){
			$(".isshowtext").show()
		}else{
			$(".isshowtext").hide()
		}
	})
	$("#val_loginPwd").on("input",function(){
		// 当点击密码输入框为空时，清空用户名。
		if ($("#val_loginPwd").val() == "") {
			$("#val_loginAccount").val("");
		}
	})
	$(".isshowtext").click(function () {
		if($(this).hasClass("show")){
			$(this).removeClass("show");
			$("#val_loginPwd").attr("type","password")
		}else{
			$(this).addClass("show");
			$("#val_loginPwd").attr("type","text")
		}
	})
	$(".menuLang>span").on("click",function(){
		$(this).toggleClass("menuSelected")
		if($(this).siblings(".langBox").is(":hidden")){
			$(this).siblings(".langBox").show();
		}else{
			$(this).siblings(".langBox").hide();
		}
	});
	$(".menuLang").hover(function(){$(this).find(".langBox").show();},function(){
		$(this).find(".langBox").hide();
	})
	$(".langBox>a").click(function(){
		$(this).addClass("langA").siblings("a").removeClass("langA");
		//$(this).parents(".langBox").hide().siblings("span").removeClass("menuSelected").text($(this).text())
	});
	$("#img_loginValidCode").click(function(){
		$(this).attr('src','/getValidateCode.do?t='+new Date().getTime());
	});

	$("#val_loginValidCode").bind('input propertychange',function(){
    	if($(this).val() == "")
			$(this).css("textTransform","");
		else
			$(this).css("textTransform","uppercase");

	});

	//回车键登录
	$(document).keydown(function(event){
		if(event.keyCode==13){
			$(".loginB").click();
		}
	});
	//登录
	$(".loginB").click(function(){
		login();
	});

	// $(".loginView").click(function(){
	// 	loginView();
	// })

	$(".toogleMenue").click(function(){
		$(".minNav").toggle();
	})
	$(".minMenuLang").click(function(){
		$(".minLangBox").toggle();
	})
	if(location.host=="www.cdn-download.com")$("#beian").show()
	if(location.host=="server-cn.growatt.com")$("#beian").show().text("粤ICP备12087124号")
	if(location.host.indexOf("smten.com")!="-1")$("#beian").show().text("粤ICP备12087124号")
})


function tipContent(text,obj){
	layer.tips(text,obj, {
		tips: [2, '#3595CC'],
			time: 3000
	});
}

//cookies_tip
$('document').ready(function (){
	$('.tip_btn').on('click', function (){
		$('.cookies_tip').fadeOut(3000);
	})
})

//验证邮箱
function validEmail(str){
	var reg = /^[a-zA-Z\d_\.\!#$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~\<\>]+@[a-zA-Z\d_\.\!#$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~\<\>]+(\.{1,2}[a-z]+)+$/;
	return reg.test(str);
}
//验证手机(宽松)
function validPhone(str){
	var reg = /^\+?[0-9]{8,16}$/;
	return reg.test(str);
}

function isEmpty(text){
	return text==undefined || text.length==0;
}


//检查用户名是否存在
function checkUserNameExist(username) {
	var exist = false;
	$.ajax({
		url : "/userCenter.do",
		type:'post',
		dataType:'text',
		data : {
			action : "checkAccountExist",
			accountName : username,
		},
		success : function(data){
			if(data=="true"){
				exist = true;
			}
		}
	});
	return exist;
}
//添加客户案例
var Customerpages;
var CustomercurrPage=1;
var plangs=0;
function addCustomerCase(currPage,currSize){
    $.ajax({
        url : "/login/getCustomerCase",
        type:'get',
        dataType:'json',
        data : {
            currPage : currPage,
            currSize : currSize,
        },
        success : function(data){
			if(data.datas.length==0){
				$(".customerCase").hide()
			}
			var plantImg=[];
            Customerpages=data.pages;
            var customerhrml="";
			customerhrml+='<div class="sameCS-con">';
            for(var i=0;i<data.datas.length;i++){
                customerhrml+='<div class="sameCS">';
                customerhrml+='<div class="sameCs_img">';
                if(data.datas[i].plantImg!="null" && data.datas[i].plantImg!=null && data.datas[i].plantImg!="" && data.datas[i].plantImg!=undefined){
                	var imgs=location.protocol+'//cdn.growatt.com/plantimg/'+data.datas[i].accountName+'/'+data.datas[i].plantImg;
                	plantImg.push(imgs)
                }else{
                    if(data.datas[i].plantType=="0"){
                    	plantImg.push('/v3/images/default_map_y.png')
                    }else{
                    	plantImg.push('/v3/images/default_map_g.png')
                    }
                }
                customerhrml+='<img width="100%" src="/v3/images/default_map_g.png">';
                customerhrml+='</div>';
                customerhrml+='<div class="sameCs_text">';
                customerhrml+='<p>';
                customerhrml+='<span title="'+data.datas[i].plantName+'">'+data.datas[i].plantName+'</span>';
                if(data.datas[i].status=="0"){
                    customerhrml+="<i class='lxColor'>Offline<!-- 离线 --></i>";
                }else if(data.datas[i].status=="1"){
                    customerhrml+="<i class='gzColor'>Fault<!-- 故障 --></i>";
                }else{
                    customerhrml+="<i class='zxColor'>Online<!-- 在线 --></i>";
                }
                customerhrml+="</p><p>"+data.datas[i].plantAddress+"</p></div>";
                customerhrml+="<table><tr><td><p>"+data.datas[i].nominalPower+"</p><p>PV Total Capacity</p></td>";
                customerhrml+="<td><p>"+data.datas[i].eToday+"</p><p>Generation Today</p></td>";
                customerhrml+="<td><p>"+data.datas[i].eTotal+"</p><p>Total Generation</p></td></tr></table></div>";
            }
			customerhrml+='</div">';
            $(".customerCase .cc-img").append(customerhrml);
            imgLoad(plantImg,0,$(".cc-img .sameCS-con").eq(plangs).find("img"))
            plangs++;
        }
        });
    }
    function imgLoad(plantImg,thisI,_this){
        let total = plantImg.length;
        $.each(plantImg,function(i,d){
            var imgs= new Image();
            imgs.src = plantImg[i];
            imgs.onload = function(){
                _this.eq(i).attr("src",plantImg[i]);
            }
        })
    }
    addCustomerCase(CustomercurrPage,4);
    $(".fxBtn .commonBtnMore").click(function(){
        CustomercurrPage++;
        if(CustomercurrPage==Customerpages)$(".fxBtn").remove();
        if(CustomercurrPage>Customerpages)return false;
        addCustomerCase(CustomercurrPage,8);
    })
    var loginOSS;
    var loging=false;

    function checkShowLogin(){
        if(ODMPARAM["ossLogin"]){
            loginOSS=true;
        }
        if(url.indexOf('server-cn.growatt.com')!=-1 || url.indexOf('server.growatt.com')!=-1 || url.indexOf('server-au.growatt.com')!=-1 || url.indexOf('server.smten.com')!=-1){
            $(".loginOSS").show();
            loginOSS=true;
        }else{
            $(".loginMon").show();
        }
    }

    //重新设置登录数据(密码md5加密到新字段)
    function resetLoginData(param){
        var oData = JSON.parse( JSON.stringify(param) );
        if(isMD5Type){
            oData.passwordCrc = MD5(oData.password);
            oData.password = '';
        }else{
            oData.passwordCrc = '';
        }
        return oData;
    }


/* 登录按钮 */
function login(newHostname){
	var isValid = "false";
	var account = $.trim($("#val_loginAccount").val());
	var password = $.trim($("#val_loginPwd").val());
	var validCode = $.trim($("#val_loginValidCode").val()).toUpperCase();
	var lang = currLang=='cn'?'cn':'en';
	if(ODMPARAM["all"]){
		isValid="false";
		$.removeCookie("isloginValidCode")
	}
	if(account == ""){// 检验用户名
		tipContent("Please enter the Username",$(".userNameVal").parents(".sameLogin-row"));
		return;
	}else if(password == ""){// 检验密码
		tipContent("Please Enter Password",$(".pasdVal").parents(".sameLogin-row"));
		return;
	}else if( isValid == "true" && (validCode == "" || validCode.length!=3)){
		$("#val_loginValidCode").focus();
		tipContent("Verification Failed",$(".checkVal").parents(".sameLogin-row"));
		$("#val_loginValidCode").val("");
		return;
	}
	
	
	
	if(!loging){
		loging=true;
		console.log("loginOSS",loginOSS)
		if(loginOSS && !login2(account,password,lang,newHostname)){
			loging=false;
			return;
		}
		
		var serverLoginData = resetLoginData( {account:account,password:password,validateCode:validCode,isReadPact:isReadPact} );
		
		$.ajax({
			url:'/login',
			type:'post',
			dataType:'json',
			data:serverLoginData,
			success:function(data){
				if(data.result==1){
					//localStorage.setItem('hasVisitedPage', 'false');
					localStorage.setItem('isFirstLogin', 'true');
					localStorage.setItem('underVoltageDialogClosed', 'false');
					localStorage.removeItem("loginVisitedPlantIdList");

					// 处理记住密码逻辑
					if($(".forgetPasd .layui-unselect").hasClass("layui-form-checked")){
						$.cookie("acu",$("#val_loginAccount").val());
						$.cookie("pwd",$("#val_loginPwd").val());
						// 同时保存到localStorage（用于自定义账户列表）
						try{
							var acct = $.trim($('#val_loginAccount').val());
							var pwd = $.trim($('#val_loginPwd').val());
							if(acct && pwd){
								saveAccount(acct, pwd);
							}
						}catch(e){
							console.error('保存账户失败:', e);
						}
					}else{
						$.cookie('acu',1,{expires:0,path:'/'});
						$.cookie('pwd',1,{expires:0,path:'/'});
						// 删除该账户
						try{
							var acct = $.trim($('#val_loginAccount').val());
							if(acct){
								removeAccount(acct);
							}
						}catch(e){}
					}
					var plantSize = $.cookie("plantSize");
					if(ODMPARAM["panelno"]){
						$.cookie("selectedPlantId",$.cookie("onePlantId"));
						window.location='/index';
					}else{
						if(plantSize>1){//电站数量大于1，则进入电站列表，否则进入panel
							window.location='/selectPlant';
						}else{
							if($.cookie("onePlantType")==0){
								$.cookie("selectedPlantId",$.cookie("onePlantId"));
								window.location='/index';
							}else{
								if(url.indexOf('server-cn.growatt.com')!=-1)
									$.cookie("b2SelectedPlantId",$.cookie("onePlantId"));
								else
									$.cookie("selectedPlantId",$.cookie("onePlantId"));
								window.location='/selectPlant/getBusiness';
							}
						}
					}
				}else if(data.result==-1){
					tipContent("Verification Failed",$(".checkVal").parents(".sameLogin-row"));
					$("#img_loginValidCode").click();
					$("#val_loginValidCode").focus();
					$("#val_loginValidCode").val("");
				}else if(data.result==-2){
						tipContent("Username or Password Error",$(".userNameVal").parents(".sameLogin-row"));
					if('true'=='true'){
						$("#img_loginValidCode").click();
						$(".loginPro-box div:eq(2)").show();
						if(ODMPARAM["all"]){
							$.removeCookie("isloginValidCode")
						}
					}
				}else if(data.result==-3){
					window.location='/login/jump';
				}else if(data.result==-4){
					layer.open({
						type:1,
						title:false,
						content:$('#ysxy_dialog'),
						success:function(dm,index){
							var msgs = '';
							
							var AgreeHtml = '';
							if(currLang == 'cn'){
								AgreeHtml = 'termsOfPolicy_zh_cn.html';
							}else{
								AgreeHtml = 'termsOfUse_en.html';
							}
							if(ODMPARAM["termsOfUse"])
								AgreeHtml=ODMPARAM["termsOfUse"]();
							var msg = '<a class="ysxy_inner" href="/userTerms/'+AgreeHtml+'">《Privacy Policy》</a>'
							
							msgs = 'In order to strengthen the protection of your personal information, we have updated our privacy policy in accordance with the latest laws and regulations. Please read carefully{}, we will use and protect your personal information in strict accordance with the content of the policy, and provide you with better services. Thank you for your trust.'.replace('{}',msg);
							$('.ysxy_mainInner').html(msgs);
							$('#layui-layer1 .layui-layer-btn').css('display','none');
							$('.ysxy_mainInner .ysxy_inner').css({'text-decoration':'none','color':'#30AFFF'});
							$("#ysxy_dialog .ysxy_Agree").unbind("click").bind("click",function(){
								PrivacyVerification();
								layer.close(index);
							});
							$("#ysxy_dialog .ysxy_Quit").unbind("click").bind("click",function(){
								layer.close(index);
							})
						}
					})
					
				}
				//弹出变更通知提示框
				else if(data.result == 4){
					updateNotice.$data.isHideMask = false;
					updateNotice.$data.serverStatus = 3;
				}
				//制裁国家判断
				else if(data.result == -5){
					layer.msg(data.msg);
				}
				else if(data.result == 8){
					//md5密码与服务器的md5不匹配，重新使用铭文密码登录
					isMD5Type = false;
					var resetQueryTimer = setTimeout(function(){									
						login(newHostname);	
						window.clearTimeout(resetQueryTimer);
					},1000*3);
					
																			
				}
			},complete:function(){
				loging=false;
			}
		})
	}

    }
    /* 弹框同意按钮 -隐私协议验证*/
    function PrivacyVerification(){
        var account = $.trim($("#val_loginAccount").val());
        $.ajax({
            url:'/login/updateProtocolStatusByUser',
            type:'POST',
            dataType:'json',
            data:{accountName:account},
            success:function(data){
                if(data.result==1){
                    login();
                }
            }
        })

    }


    function login2(account,password,lang,newHostname) {

        $("#accountError").text('');
        login3(account,password,lang);
        var result = false;
        if(newHostname){
            var mainUrl = newHostname + '/login';
        }else{
            var mainUrl = url.split(":")[0]+'://'+ODMPARAM["ossUrl"]+'/login';
        }
        requestData = {userName:account,password:password,lang:lang,loginTime:getDateText(null,4),type:localStorage.getItem("login_type2") || 1};
        requestData = resetLoginData(requestData);
        $.ajax({
            url:mainUrl,
            type:'post',
            dataType:'json',
            async:false,
            data:requestData,
            success:function(data){

                if(data.result==1){
                    //有oss分区标识，去掉分区标识
                    if( localStorage.getItem("login_type2") ){
                        localStorage.removeItem("login_type2");
                    }
                    if(newHostname){//有分区域名
                        setTimeout(function(){
                            window.location.href = newHostname;
                        },50);
                    }else{
                        if(ODMPARAM["all"]) {
                            window.location=url.split(":")[0]+'://'+ODMPARAM["ossUrl"]+'?lang='+LANGS;
                        }else{
                            window.location=url.split(":")[0]+'://'+ODMPARAM["ossUrl"];
                        }
                    }

                    if(data.obj && data.obj.length > 0){
                        if(LANG == "cn" || LANG == "ft"){
                            layer.msg("账户不存在，请尝试其他服务器登录");
                        }
                        else{
                            layer.msg("The account does not exist, please try another server to log in.");
                        }
                    }
                }
                else{
                    result = true;
                    if(data.result == "3"){//检测账号存在多个服务区
                        result = false;
                        updateNotice.$data.isHideMask = false;
                        updateNotice.$data.serverStatus = 1;
                        //根据当前域名修改currHostname和areaList的状态
                        updateNotice.updateHostname(function(){

                        });
                        //根据后台返回的域名数据list
                        if(data.obj && typeof data.obj == "object"){
                            for(var i=0;i<data.obj.length;i++){
                                data.obj[i].active = false;
                                data.obj[i].on = false;
                            }
                            updateNotice.$data.areaList = data.obj;
                            updateNotice.$data.sureChooseBtnActive = false;
                        }
                    }
                    else if(data.result == "6"){

                        //var LoginUrl = getNeverRequest(oLoginCheckUrl);
                        if(currLang == "cn" || currLang == "ft"){
                            var ts = "账户不存在，请尝试其他服务器登录!";
                        }
                        else{
                            var ts = "The account does not exist, please try another server to log in.";
                        }
                        //根据后台返回的域名数据list
                        if(data.obj && typeof data.obj == "object"){
                            for(var i=0;i<data.obj.length;i++){
                                data.obj[i].active = false;
                                data.obj[i].on = false;
                            }
                            updateNotice.$data.areaList = data.obj;
                            updateNotice.$data.sureChooseBtnActive = false;
                        }

                        updateNotice.$data.fenquContent = ts;
                        updateNotice.$data.isHideMask = false;
                        updateNotice.$data.serverStatus = 1;
                    }
                    else if(data.result == 8){
                        //md5密码与服务器的md5不匹配，重新使用铭文密码登录
                        isMD5Type = false;
                        var resetQueryTimer = setTimeout(function(){
                            login2(account,password,lang,newHostname);
                            window.clearTimeout(resetQueryTimer);
                        },1000*3);
                    }
                    /* else if(data.result==7){
                        //$("#err_login").text('your_account_will_be_temporarily_locked');//系统将暂时锁定您的帐号，请稍后再次尝试。
					layer.alert(
							data.msg,
							{title:`Tips`,btn:[`Yes`]}
					);
				}
				else if(data.result==0){
					if(data.msg.substr(0, 1) == "{"){
						//返回当前登录失败次数
						var msg = JSON.parse(data.msg);
						var failNum = msg.failures;
						var err_msg = '';
						if(failNum < 3){
							err_msg = `Username or Password Error`;//用户名或密码错误
						}else if(failNum == 3){
							err_msg = `密码输入错误3次，剩余2次机会，输入错误5次后系统将锁定您的账号，请检查输入密码`;//密码输入错误3次，剩余2次机会，输入错误5次后系统将锁定您的账号，请检查输入密码。
						}else if(failNum == 4){
							err_msg = `密码输入错误4次，剩余1次机会，输入错误5次后系统将锁定您的账号，请检查输入密码`;//密码输入错误4次，剩余1次机会，输入错误5次后系统将锁定您的账号，请检查输入密码。
						}else{
							err_msg = `密码输入错误5次，系统将暂时锁定您的账号，请15分钟后再次尝试`;//密码输入错误5次，系统将暂时锁定您的账号，请15分钟后再次尝试。
						}

						layer.alert(
								err_msg,
								{title:`Tips`,btn:[`Yes`]}
						);
					}else{
						//返回当前系统较为繁忙，请稍后重试
						layer.msg(data.msg);
					}
				} */
                }
            },error:function(){
                result = true;
            }
        })

        return result;

    }
    //需要再执行调用接口一次，并传noRecord，才可以登录并跳转成功
    function login3(account,password,lang){
        var d = resetLoginData( {userName:account,password:password,lang:lang,loginTime:getDateText(null,4),noRecord:"true",type:localStorage.getItem("login_type2") || 1} );
        $.ajax({
            url:url.split(":")[0]+'://'+ODMPARAM["ossUrl"]+'/login',
            async:false,
            type:'post',
            dataType:'json',
            data:d,
            xhrFields:{withCredentials:true},
            success:function(data){
                if(data.result == 8){
                    //md5密码与服务器的md5不匹配，重新使用铭文密码登录
                    isMD5Type = false;
                    var resetQueryTimer = setTimeout(function(){
                        login3(account,password,lang);
                        window.clearTimeout(resetQueryTimer);
                    },1000*3);
                }
            },complete:function(){
            }
        })
    }

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    


function getCurrLang(){
	var lang = $.cookie('lang');
	return lang || 'en';
}
function changeLang(lang){
	// $.cookie('lang',lang,{expires:30,path:'/'});
	$.cookie('lang',lang);
	window.location.href='?lang='+lang;
}
function getDateText(d,type){
	if(d==undefined)
		d = new Date();
	if(type==1)
		return d.getFullYear();
	else if(type==2)
		return d.getFullYear()+'-'+addZero(d.getMonth()+1);
	else if(type==4)
		return d.getFullYear()+'-'+addZero(d.getMonth()+1)+'-'+addZero(d.getDate())+" "+addZero(d.getHours())+":"+addZero(d.getMinutes())+":"+addZero(d.getSeconds());
	return d.getFullYear()+'-'+addZero(d.getMonth()+1)+'-'+addZero(d.getDate());
}
function addZero(num){
	if(num<10)
		num='0'+num;
	return num+'';
}
// var browserLang=(navigator.language || navigator.browserLanguage).toLowerCase();
// var browserLangTwo=browserLang.slice(0,2);
// if($.cookie('lang')==undefined){
// 	var temp={'zh-cn':"cn",'zh-tw':"hk",'zh-hk':"hk",'en':"en","fr":'fr',"ja":"ja","it":"it","nl":"ho","tr":"tk","pl":"pl","el":"gk","de":"gm","pt":"pt","es":"sp",'vi':"vn"};
// 	var tiaoLang=temp[browserLangTwo] || temp[browserLang] || "cn";
// 	changeLang(tiaoLang)
// }
// function loginbanner(){
// 	$(".turanslate1 ").addClass("active");
// 	setTimeout(function(){
// 		$(".turanslate1 ").removeClass("active");
// 		$(".turanslate2 ").addClass("active");
// 		$(".turanslate3 ").addClass("active");
// 		setTimeout(function(){
// 			$(".turanslate2 ").removeClass("active");
// 		},2000)
// 		setTimeout(function(){
// 			$(".turanslate3 ").removeClass("active");
// 		},3000)
// 	},2000)
// }
// loginbanner();
// setInterval(function(){loginbanner()},5000)

// 保存账户管理（本地记住用户名和密码)
(function(){
    // (使用 Base64加密/解密)
    function encryptPassword(pwd){
        try{ return btoa(unescape(encodeURIComponent(pwd))); }catch(e){ return pwd; }
    }
    function decryptPassword(encPwd){
        try{ return decodeURIComponent(escape(atob(encPwd))); }catch(e){ return encPwd; }
    }
    
    // 获取已保存账户数组
    function getSavedAccounts(){
        try{var s = localStorage.getItem('savedAccounts'); return s?JSON.parse(s):[]}catch(e){return []}
    }
    // 保存或更新账户（密码加密存储)
    window.saveAccount = function(account,password){
        if(!account) return;
        var arr = getSavedAccounts();
        var encPwd = encryptPassword(password);
        var found = false;
        for(var i=0;i<arr.length;i++){
            if(arr[i].account===account){ arr[i].password = encPwd; found=true; break; }
        }
        if(!found){ arr.push({account:account,password:encPwd}); }
        try{ localStorage.setItem('savedAccounts', JSON.stringify(arr)); }catch(e){console.warn(e)}
        renderSavedAccounts();
		$('.savedAccountsList').hide()
    }
    // 删除账户
    window.removeAccount = function(account){
        if(!account) return;
        var arr = getSavedAccounts();
        var n = arr.filter(function(a){ return a.account!==account });
        try{ localStorage.setItem('savedAccounts', JSON.stringify(n)); }catch(e){}
        renderSavedAccounts();
    }
    // 在用户名输入框下方渲染账户列表
    window.renderSavedAccounts = function(){
        var arr = getSavedAccounts();
        var $row = $('.sameLogin-row').has('#val_loginAccount').first();
        if(!$row.length) return;
        $row.css('position','relative');
        var $list = $row.find('.savedAccountsList');
        if(!$list.length){
            $list = $('<div class="savedAccountsList"></div>');
            $row.append($list);
        }
        $list.empty();
        if(!arr || arr.length===0){ $list.hide(); return; }
        for(var i=0;i<arr.length;i++){
            (function(item){
                var ac = $('<div class="savedItem" data-ac="'+item.account+'"><span class="sa-name">'+item.account+'</span><span class="sa-del">×</span></div>');
                ac.on('click', function(e){
                    if($(e.target).hasClass('sa-del')) return;
                    $('#val_loginAccount').val(item.account);
                    $('#val_loginPwd').val(decryptPassword(item.password));
                    $('.remember').prop('checked', true);
                    try{ form && form.render(); }catch(e){}
                    $list.hide();
                });
                ac.find('.sa-del').on('click', function(e){ e.stopPropagation(); removeAccount(item.account); });
                $list.append(ac);
            })(arr[i]);
        }
        $list.show();
    }

    // 点击用户图标切换列表显示
    $(document).on('click', '.arrows_x', function(e){
        e.stopPropagation();
        var $row = $(this).closest('.sameLogin-row');
		if($row.find('.savedItem').length===0) {
			return;
		}
        $row.css('position','relative');
        var $list = $row.find('.savedAccountsList');
        if(!$list.length) {
			renderSavedAccounts();
		}
        $row.find('.savedAccountsList').toggle();
    });
    // 点击外部时隐藏列表
    $(document).on('click', function(){ $('.savedAccountsList').hide(); });


    // 初始化渲染（默认隐藏）
    $(function(){ try{ renderSavedAccounts(); $('.savedAccountsList').hide(); }catch(e){} });
})();

</script>
</body></html>
