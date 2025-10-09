<?php
ini_set("memory_limit", "256M");
ini_set("max_execution_time", 3600);
ini_set("date.timezone","America/Sao_Paulo");

require_once("".str_replace("/robots","",realpath(dirname(__FILE__)))."/admin/inc/conecta.php");
require_once("".str_replace("/robots","",realpath(dirname(__FILE__)))."/admin/inc/funcoes.php");
require_once("".str_replace("/robots","",realpath(dirname(__FILE__)))."/admin/inc/classe.ssh.php");

function gerenciar_live_wowza_robot($servidor,$senha,$login,$live,$acao) {

$url = "http://".$servidor.":6980/v2/servers/_defaultServer_/vhosts/_defaultVHost_/applications/".$login."/pushpublish/mapentries/".$live."/actions/".$acao."";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_USERPWD, "admin:".code_decode($senha,"D").""); 
curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_DIGEST); 
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, FALSE); 
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, FALSE); 
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 20);
curl_setopt($ch, CURLOPT_TIMEOUT, 20);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER,array('Content-Type:application/json','Accept:application/json'));
$resultado = curl_exec($ch);
curl_close($ch);

if(preg_match('/successfully/i',$resultado)) {
return "ok";
} else {
return "erro";
}

}

function tempo_exec_live($date){$first = new DateTime($date);$second = new DateTime("now");$diff = $first->diff( $second );$minutes = $diff->days * 24 * 60;$minutes += $diff->h * 60;$minutes += $diff->i;return $minutes;}

parse_str($argv[1],$opcoes);

list($inicial,$final) = explode("-",$opcoes["registros"]);

echo "[".date("d/m/Y H:i:s")."] Processo Iniciado.\n";

$data_atual_servidor = date("Y-m-d H:i");

$query = mysqli_query($conexao,"SELECT *, DATE_FORMAT(data_inicio,'%Y-%m-%d %H:%i') AS data_inicio, DATE_FORMAT(data_fim,'%Y-%m-%d %H:%i') AS data_fim FROM lives ORDER by codigo ASC LIMIT ".$inicial.", ".$final."");
while ($dados_live = mysqli_fetch_array($query)) {

$dados_stm = mysqli_fetch_array(mysqli_query($conexao,"SELECT * FROM streamings where codigo = '".$dados_live["codigo_stm"]."'"));
$dados_servidor = mysqli_fetch_array(mysqli_query($conexao,"SELECT * FROM servidores where codigo = '".$dados_stm["codigo_servidor"]."'"));

$data_atual = formatar_data("Y-m-d H:i", $data_atual_servidor, $dados_stm["timezone"]);

$live = $dados_live["tipo"]."_".$dados_live["codigo"];

if($dados_servidor["nome_principal"]) {
$servidor = strtolower($dados_servidor["nome_principal"]).".".$dados_config["dominio_padrao"];
} else {
$servidor = strtolower($dados_servidor["nome"]).".".$dados_config["dominio_padrao"];
}

$source_rtmp = "rtmp://".$servidor.":1935/".$dados_stm["login"]."/".$dados_stm["login"]."";


////////////////////////////
// Inicialização de lives //
////////////////////////////

if($dados_stm["status"] == 1 && $dados_servidor["status"] == "on") {

if($dados_live["status"] == 2 && $dados_live["data_inicio"] == $data_atual) {

// Conexao SSH
$ssh = new SSH();
$ssh->conectar($dados_servidor["ip"],$dados_servidor["porta_ssh"]);
$ssh->autenticar("root",code_decode($dados_servidor["senha"],"D"));

if($dados_live["tipo"] == "tiktok" || $dados_live["tipo"] == "kwai" || $dados_live["tipo"] == "instagram") {

$servidor_live_tiktok_kwai = $dados_live["live_servidor"].'/'.$dados_live["live_chave"];

$ssh->executar('echo OK;screen -dmS '.$dados_stm["login"].'_'.$dados_live["codigo"].' bash -c "/usr/local/bin/ffmpeg -re -i '.$source_rtmp.' -vf \'crop=ih*(9/16):ih\' -crf 21 -r 24 -g 48 -b:v 3000000 -b:a 128k -ar 44100 -acodec aac -vcodec libx264 -preset ultrafast -bufsize \'(6.000*3000000)/8\' -maxrate 3500000 -threads 1 -f flv \''.$servidor_live_tiktok_kwai.'\'; exec sh"');

sleep(5);

$resultado = $ssh->executar("/bin/ps aux | /bin/grep ffmpeg | /bin/grep rtmp | /bin/grep ".$dados_stm["login"]." | /bin/grep 'tiktok\|kwai\|fbcdn' | /usr/bin/wc -l");

} else {

$live_target = ''.$dados_stm["login"].'={"entryName":"'.$live.'", "profile":"rtmp", "application":"'.$dados_live["live_app"].'", "host":"'.$dados_live["live_servidor"].'", "streamName":"'.$dados_live["live_chave"].'"}';

$ssh->executar("echo '".$live_target."' >> /usr/local/WowzaStreamingEngine/conf/".$dados_stm["login"]."/PushPublishMap.txt;echo OK");

$resultado = gerenciar_live_wowza_robot($dados_servidor["ip"],$dados_servidor["senha"],$dados_stm["login"],$live,"enable");

}

if($resultado == "ok" || $resultado > 0) {

echo "[".$dados_stm["login"]."][".$data_atual_servidor."][".$dados_live["data_inicio"]."] Iniciando live ".$dados_live["tipo"]."\n";

// Atualiza status para transmitindo
mysqli_query($conexao,"Update lives set status = '1' where codigo = '".$dados_live["codigo"]."'");

} else {

echo "[".$dados_stm["login"]."][".$data_atual_servidor."][".$dados_live["data_inicio"]."] Erro ao iniciar live ".$dados_live["tipo"]."\n";

// Atualiza status para transmitindo
mysqli_query($conexao,"Update lives set status = '3' where codigo = '".$dados_live["codigo"]."'");

} 

}

} // FIM -> Verifica se o streaming e servidor esta ON/OFF

//////////////////////////
// Finalização de lives //
//////////////////////////

if($dados_live["status"] == 1 && $dados_live["data_fim"] == $data_atual) {

gerenciar_live_wowza_robot($dados_servidor["ip"],$dados_servidor["senha"],$dados_stm["login"],$live,"disable");

echo "[".$dados_stm["login"]."][".$data_atual_servidor."][".$dados_live["data_fim"]."] Live ".$dados_live["tipo"]." finalizada.\n";

// Atualiza status para transmitindo
mysqli_query($conexao,"Update lives set status = '0' where codigo = '".$dados_live["codigo"]."'");
}

////////////////////////////////////////////////////////
// Finalização de lives com mais de 24hs de execussão //
////////////////////////////////////////////////////////
$tempo_exec = tempo_exec_live($dados_live["data_inicio"]);

if($dados_live["status"] == 1 && $tempo_exec > 1440) {

gerenciar_live_wowza_robot($dados_servidor["ip"],$dados_servidor["senha"],$dados_stm["login"],$live,"disable");

echo "[".$dados_stm["login"]."][".$data_atual_servidor."][".$dados_live["data_fim"]."] Live ".$dados_live["tipo"]." finalizada por estar transmitindo a mais de 24hs.\n";

// Atualiza status para transmitindo
mysqli_query($conexao,"Update lives set status = '0' where codigo = '".$dados_live["codigo"]."'");

}

} // FIM -> while

echo "\n[".date("d/m/Y H:i:s")."] Processo Concluído.\n\n";

?>