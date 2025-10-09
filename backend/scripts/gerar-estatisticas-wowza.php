<?php
ini_set("date.timezone","America/Sao_Paulo");
ini_set("max_execution_time", 1800);

require_once("".str_replace("/robots","",realpath(dirname(__FILE__)))."/admin/inc/conecta.php");
require_once("".str_replace("/robots","",realpath(dirname(__FILE__)))."/admin/inc/funcoes.php");

$inicio_execucao = tempo_execucao();

parse_str($argv[1],$opcoes);

list($inicial,$final) = explode("-",$opcoes["registros"]);

echo "\n\n--------------------------------------------------------------------\n\n";

// Grava cache com o XML do wowza de todos os servidores
$sql_servidores = mysqli_query($conexao,"SELECT * FROM servidores ORDER by ordem ASC");
while ($dados_servidor = mysqli_fetch_array($sql_servidores)) {

$xml_wowza = estatistica_streaming_robot($dados_servidor["ip"],$dados_servidor["senha"]);
$xml_wowza_webrtc = estatistica_streaming_robot_webrtc($dados_servidor["ip"],$dados_servidor["senha"]);

$array_xml["stats"][$dados_servidor["codigo"]] = $xml_wowza;
$array_xml["stats_webrtc"][$dados_servidor["codigo"]] = $xml_wowza_webrtc;

echo "Servidor Wowza: ".$dados_servidor["nome"]."\n";
echo "\n--------------------------------------------------------------------\n\n";

}

echo "\n--------------------------------------------------------------------\n\n";

$array_user_agents = array("Wirecast","Teradek","vmix","Vmix","FMLE","GoCoder");

// Gera as estatisticas
$sql = mysqli_query($conexao,"SELECT * FROM streamings where status = '1' ORDER by login ASC LIMIT ".$inicial.", ".$final."");
while ($dados_stm = mysqli_fetch_array($sql)) {

$array_espectadores = array();

$dados_servidor = mysqli_fetch_array(mysqli_query($conexao,"SELECT * FROM servidores where codigo = '".$dados_stm["codigo_servidor"]."'"));

if($dados_servidor["status"] == "on") {

if($dados_stm["aplicacao"] != "webrtc") {

$xml_stats_wowza = $array_xml["stats"][$dados_servidor["codigo"]];

$total_registros_wowza = @count($xml_stats_wowza->VHost->Application);

if($total_registros_wowza > 0) {

for($i=0;$i<$total_registros_wowza;$i++){

if($xml_stats_wowza->VHost->Application[$i]->Name == $dados_stm["login"] && ($xml_stats_wowza->VHost->Application[$i]->Status == "loaded" || $xml_stats_wowza->VHost->Application[$i]->Status == "")) {

// ApplicationInstance [0]
$total_espectadores_wowza = count($xml_stats_wowza->VHost->Application[$i]->ApplicationInstance->Client);

for($a=0;$a<$total_espectadores_wowza;$a++){

$status_transmissao = status_aovivo($xml_stats_wowza->VHost->Application[$i]->ApplicationInstance->Client[$a]->FlashVersion);

if($status_transmissao != "aovivo") {

$ip_wowza = $xml_stats_wowza->VHost->Application[$i]->ApplicationInstance->Client[$a]->IpAddress;
$tempo_conectado_wowza = $xml_stats_wowza->VHost->Application[$i]->ApplicationInstance->Client[$a]->TimeRunning;
$player_wowza = formatar_useragent($xml_stats_wowza->VHost->Application[$i]->ApplicationInstance->Client[$a]->Proxy);

if(filter_var($ip_wowza, FILTER_VALIDATE_IP)) {
$array_espectadores["".$ip_wowza.""] = $tempo_conectado_wowza."|".$player_wowza."";
}

}
}

// ApplicationInstance [1]
$total_espectadores_wowza2 = @count($xml_stats_wowza->VHost->Application[$i]->ApplicationInstance[1]->Client);

for($b=0;$b<$total_espectadores_wowza2;$b++){

$status_transmissao = status_aovivo($xml_stats_wowza->VHost->Application[$i]->ApplicationInstance[1]->Client[$b]->FlashVersion);

if($status_transmissao != "aovivo") {

$ip_wowza = $xml_stats_wowza->VHost->Application[$i]->ApplicationInstance[1]->Client[$b]->IpAddress;
$tempo_conectado_wowza = $xml_stats_wowza->VHost->Application[$i]->ApplicationInstance[1]->Client[$b]->TimeRunning;
$player_wowza = formatar_useragent($xml_stats_wowza->VHost->Application[$i]->ApplicationInstance->Client[$a]->Proxy);

if(filter_var($ip_wowza, FILTER_VALIDATE_IP)) {
$array_espectadores["".$ip_wowza.""] = $tempo_conectado_wowza."|".$player_wowza."";
}

}

}
break;

}

}

}

} else {

$xml_stats_wowza = $array_xml["stats_webrtc"][$dados_servidor["codigo"]];

$total_registros_wowza = @count($xml_stats_wowza->VHost->Application);

if($total_registros_wowza > 0) {

for($i=0;$i<$total_registros_wowza;$i++){

if($xml_stats_wowza->VHost->Application[$i]->Name == $dados_stm["login"] && ($xml_stats_wowza->VHost->Application[$i]->Status == "loaded" || $xml_stats_wowza->VHost->Application[$i]->Status == "")) {

$total_espectadores = $xml_stats_wowza->VHost->Application[$i]->ApplicationInstance->RTPSessionCount;

for($ii=0;$ii<$total_espectadores;$ii++){
        
    $status_transmissao = status_aovivo($xml_stats_wowza->VHost->Application[$i]->ApplicationInstance->RTPSession[$ii]->Mode);

    if($status_transmissao != "aovivo") {
        $array_espectadores["".$xml_stats_wowza->VHost->Application[$i]->ApplicationInstance->RTPSession[$ii]->IpAddress.""] = $xml_stats_wowza->VHost->Application[$i]->ApplicationInstance->RTPSession[$ii]->TimeRunning."|WebRTC";
    }

}

break;
}
}
}

} // fim webrtc


// Insere os espectadores no banco de dados
foreach($array_espectadores as $ip => $espectador) {

list($tempo_conectado, $player) = explode("|",$espectador);

if(!empty($ip) && !empty($tempo_conectado) && !empty($player)) {

$verifica_espectador = mysqli_num_rows(mysqli_query($conexao,"SELECT * FROM estatisticas where codigo_stm = '".$dados_stm["codigo"]."' AND (ip = '".$ip."' AND data = '".date("Y-m-d")."')"));

if($verifica_espectador == 0) {

// Verifica se ja tem no banco de dados de geoip e usa banco de dados ao invez da API
$verifica_ip_geoip_db_atual = mysqli_num_rows(mysqli_query($conexao,"SELECT * FROM geoip where ip = '".$ip."'"));

if($verifica_ip_geoip_db_atual == 0) {

$dados_api_geoip = api_geoip($ip);

$ip_pais_codigo = $dados_api_geoip["pais_sigla"];
$ip_pais_nome = $dados_api_geoip["pais_nome"];
$ip_estado = $dados_api_geoip["estado"];
$ip_cidade = $dados_api_geoip["cidade"];

$latitude = $dados_api_geoip["latitude"];
$longitude = $dados_api_geoip["longitude"];

$db_usado = "GEOIP";

mysqli_query($conexao,"INSERT INTO geoip (ip,pais_sigla,pais_nome,estado,cidade,latitude,longitude) VALUES ('".$ip."','".$ip_pais_codigo."','".$ip_pais_nome."','".$ip_estado."','".$ip_cidade."','".$latitude."','".$longitude."')");

} else {

$dados_ip_geoip_db = mysqli_fetch_array(mysqli_query($conexao,"SELECT * FROM geoip where ip = '".$ip."'"));

$ip_pais_codigo = $dados_ip_geoip_db["pais_sigla"];
$ip_pais_nome = $dados_ip_geoip_db["pais_nome"];
$ip_estado = $dados_ip_geoip_db["estado"];
$ip_cidade = $dados_ip_geoip_db["cidade"];

$db_usado = "DB";

}

mysqli_query($conexao,"INSERT INTO estatisticas (codigo_stm,data,hora,ip,pais,estado,cidade,tempo_conectado,player) VALUES ('".$dados_stm["codigo"]."',NOW(),NOW(),'".$ip."','".$ip_pais_nome."','".addslashes($ip_estado)."','".addslashes($ip_cidade)."','".$tempo_conectado."','".$player."')") or die("Erro MySQL: ".mysqli_error($conexao));

echo "[".$dados_stm["login"]."][".$db_usado."] Espectador: ".$ip." adicionado.\n";

} else {

mysqli_query($conexao,"Update estatisticas set tempo_conectado = '".$tempo_conectado."' where codigo_stm = '".$dados_stm["codigo"]."' AND (ip = '".$ip."' AND data = '".date("Y-m-d")."')") or die("Erro MySQL: ".mysqli_error($conexao));

echo "[".$dados_stm["login"]."] Espectador: ".$ip." atualizado.\n";

}

}

} // foreach

} // status servidor

} // while


$fim_execucao = tempo_execucao();

$tempo_execucao = number_format(($fim_execucao-$inicio_execucao),2);

echo "\n\n--------------------------------------------------------------------\n\n";
echo "Tempo: ".$tempo_execucao." segundo(s);\n\n";
?>