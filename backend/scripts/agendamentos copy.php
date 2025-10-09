<?php
ini_set("memory_limit", "256M");
ini_set("max_execution_time", 3600);
ini_set("date.timezone","America/Sao_Paulo");

require_once("".str_replace("/robots","",realpath(dirname(__FILE__)))."/admin/inc/conecta.php");
require_once("".str_replace("/robots","",realpath(dirname(__FILE__)))."/admin/inc/funcoes.php");
require_once("".str_replace("/robots","",realpath(dirname(__FILE__)))."/admin/inc/classe.ftp.php");

// Função para gerar arquivo de configuração do Ondemand
function gerar_playlist_finalizacao($config) {

$conteudo_atual = file_get_contents("/home/painelvideo/public_html/temp/".$config["login"]."_playlists_agendamentos.smil");
$conteudo_atual = str_replace('</body>','',$conteudo_atual);
$conteudo_atual = str_replace('</smil>','',$conteudo_atual);
$conteudo_atual = str_replace('true','false',$conteudo_atual);
file_put_contents("/home/painelvideo/public_html/temp/".$config["login"]."_playlists_agendamentos.smil", $conteudo_atual);

if($config["playlists"]) {
foreach($config["playlists"] as $playlist_config) {
if($playlist_config["total_videos"] > 0) {
$conteudo .= "<playlist name=\"".$playlist_config["playlist"]."\" playOnStream=\"".$config["login"]."\" repeat=\"true\" scheduled=\"".$playlist_config["data_inicio"]."\">\n";
$start = ($playlist_config["start"]) ? $playlist_config["start"] : "0";
$lista_videos = explode(",",$playlist_config["videos"]);
foreach($lista_videos as $video) {
$video = str_replace("%20"," ",$video);
$conteudo .= "<video length=\"-1\" src=\"mp4:".$video."\" start=\"".$start."\"></video>\n";
}
$conteudo .= "</playlist>\n\n";
}
}
}
$conteudo .= "</body>\n";
$conteudo .= "</smil>\n";
file_put_contents("/home/painelvideo/public_html/temp/".$config["login"]."_playlists_agendamentos.smil", $conteudo, FILE_APPEND);
return $config["login"]."_playlists_agendamentos.smil";
}

parse_str($argv[1],$opcoes);

list($inicial,$final) = explode("-",$opcoes["registros"]);

echo "[".date("d/m/Y H:i:s")."] Processo Iniciado.\n";

$hora_atual_servidor = date("H:i");

$query1 = mysqli_query($conexao,"SELECT * FROM playlists_agendamentos ORDER by codigo ASC LIMIT ".$inicial.", ".$final."");
while ($dados_agendamento = mysqli_fetch_array($query1)) {

$lista_videos = "";
$total_videos_playlist = "";

$dados_stm = mysqli_fetch_array(mysqli_query($conexao,"SELECT * FROM streamings where codigo = '".$dados_agendamento["codigo_stm"]."'"));
$dados_playlist = mysqli_fetch_array(mysqli_query($conexao,"SELECT * FROM playlists where codigo = '".$dados_agendamento["codigo_playlist"]."'"));
$dados_playlist_finalizacao = mysqli_fetch_array(mysqli_query($conexao,"SELECT * FROM playlists where codigo = '".$dados_agendamento["codigo_playlist_finalizacao"]."'"));

$hora_inicio = sprintf("%02d",$dados_agendamento["hora"]).":".sprintf("%02d",$dados_agendamento["minuto"]);
$hora_atual = formatar_data("H:i", $hora_atual_servidor, $dados_stm["timezone"]);
$data_atual = date("Y-m-d");

$misturar = ($dados_agendamento["shuffle"] == "sim") ? "RAND()" : "ordem+0,codigo ASC";

if($dados_stm["status"] == 1) {

$dados_servidor = mysqli_fetch_array(mysqli_query($conexao,"SELECT * FROM servidores where codigo = '".$dados_stm["codigo_servidor"]."'"));

if($dados_servidor["status"] == "on") {

//////////////////////////////////////////////////////////////
//// Frequência 1 -> Executar em data específica(uma vez) ////
//////////////////////////////////////////////////////////////

if($dados_agendamento["frequencia"] == 1) {

// Verifica se a data específica é hoje e se esta na hora de iniciar
if($dados_agendamento["data"] == $data_atual && $hora_inicio == $hora_atual) {

if($dados_agendamento["tipo"] == "playlist") {

	// Cria o arquivo da playlist para enviar para servidor
	$total_videos_playlist = 0;
	$query_videos = mysqli_query($conexao,"SELECT * FROM playlists_videos where codigo_playlist = '".$dados_playlist["codigo"]."' ORDER by ".$misturar."");
	while ($dados_playlist_video = mysqli_fetch_array($query_videos)) {
		$lista_videos .= $dados_playlist_video["path_video"].",";
		$total_videos_playlist++;
	}
	
	$config_playlist[$playlist]["playlist"] = formatar_nome_playlist($dados_playlist["nome"]);
	$config_playlist[$playlist]["data_inicio"] = date("Y-m-d H:i:s");
	$config_playlist[$playlist]["total_videos"] = $total_videos_playlist;
	$config_playlist[$playlist]["videos"] = substr($lista_videos,0,-1);
	
	$array_config_playlists = array ("login" => $dados_stm["login"], "playlists" => $config_playlist);

} else {

	$config_playlist[$relay]["playlist"] = "relay";
	$config_playlist[$relay]["data_inicio"] = date("Y-m-d H:i:s");
	$config_playlist[$relay]["total_videos"] = 1;
	$config_playlist[$relay]["videos"] = "relay-".md5($dados_agendamento["servidor_relay"]).".stream";
	$config_playlist[$relay]["start"] = "-2";
	
	$array_config_playlists = array ("login" => $dados_stm["login"], "playlists" => $config_playlist);
	
	// Inicia o arquivo de stream do relay no wowza
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, "http://".$dados_servidor["ip"].":555/streammanager/streamAction?action=startStream&vhostName=_defaultVHost_&appName=".$dados_stm["login"]."%2F_definst_&streamName=relay-".md5($dados_agendamento["servidor_relay"]).".stream&groupId=&mediaCasterType=liverepeater");
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt($ch, CURLOPT_TIMEOUT, 5);
	curl_setopt($ch, CURLOPT_USERPWD, "admin:".code_decode($dados_servidor["senha"],"D").""); 
	curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_DIGEST); 
	curl_setopt($ch, CURLOPT_USERAGENT, 'Painel de Streaming 3.0.0');
	curl_exec($ch);
	curl_close($ch);

}
	
$resultado = gerar_playlist($array_config_playlists);

// Gera playlist de finalizacao
if($dados_agendamento["finalizacao"] == "iniciar_playlist") {

$duracao = mysqli_fetch_array(mysqli_query($conexao,"SELECT *,SUM(duracao_segundos) as total FROM playlists_videos where codigo_playlist = '".$dados_playlist["codigo"]."'"));

$duracao_playlist_agendada = $duracao["total"]-2;

// Cria o arquivo da playlist para enviar para servidor
$total_videos_playlist_finalizacao = 0;
$query_videos_finalizacao = mysqli_query($conexao,"SELECT * FROM playlists_videos where codigo_playlist = '".$dados_playlist_finalizacao["codigo"]."' ORDER by ".$misturar."");
while ($dados_playlist_video_finalizacao = mysqli_fetch_array($query_videos_finalizacao)) {
	$lista_videos_finalizacao .= $dados_playlist_video_finalizacao["path_video"].",";
	$total_videos_playlist_finalizacao++;
}
	
$config_playlist_finalizacao[$playlist]["playlist"] = formatar_nome_playlist($dados_playlist_finalizacao["nome"]);
$config_playlist_finalizacao[$playlist]["data_inicio"] = date("Y-m-d H:i:s", strtotime("+".$duracao_playlist_agendada." second"));
$config_playlist_finalizacao[$playlist]["total_videos"] = $total_videos_playlist_finalizacao;
$config_playlist_finalizacao[$playlist]["videos"] = substr($lista_videos_finalizacao,0,-1);
	
$array_config_playlist_finalizacao = array ("login" => $dados_stm["login"], "playlists" => $config_playlist_finalizacao);

gerar_playlist_finalizacao($array_config_playlist_finalizacao);

}

// Envia playlist para servidor
// Conexão FTP
$ftp = new FTP();
$ftp->conectar($dados_servidor["ip"]);
$ftp->autenticar($dados_stm["login"],$dados_stm["senha"]);

$ftp->enviar_arquivo("".str_replace("/robots","",realpath(dirname(__FILE__)))."/temp/".$resultado."","playlists_agendamentos.smil");
@unlink("".str_replace("/robots","",realpath(dirname(__FILE__)))."/temp/".$resultado."");

// Inicia a playlist no Wowza
recarregar_playlists_agendamentos($dados_servidor["ip"],$dados_servidor["senha"],$dados_stm["login"]);

echo "[0x01][".$dados_stm["porta"]."][".date_default_timezone_get()."][".$dados_stm["timezone"]."][".$hora_atual_servidor."][".$hora_inicio."] Iniciando playlist ".$dados_playlist["nome"]." em ".$dados_agendamento["data"]." as ".$hora_inicio."\n";

// Atualiza a última playlist tocada
mysqli_query($conexao,"Update streamings set ultima_playlist = '".$dados_playlist["codigo"]."' where codigo = '".$dados_stm["codigo"]."'");

// Loga a ação executada
mysqli_query($conexao,"INSERT INTO playlists_agendamentos_logs (codigo_agendamento,codigo_stm,data,playlist) VALUES ('".$dados_agendamento["codigo"]."','".$dados_stm["codigo"]."',NOW(),'".$dados_playlist["nome"]."')");

// Remove o agendamento
mysqli_query($conexao,"Delete From playlists_agendamentos where codigo = '".$dados_agendamento["codigo"]."'");

} // FIM -> Verifica se esta na hora de iniciar / Frequência 1

} elseif($dados_agendamento["frequencia"] == 2) { // Else -> frequencia 2

//////////////////////////////////////////////
//// Frequência 2 -> Executar Diariamente ////
//////////////////////////////////////////////

// Verifica se esta na hora de iniciar
if($hora_inicio == $hora_atual) { 

if($dados_agendamento["tipo"] == "playlist") {

	// Cria o arquivo da playlist para enviar para servidor
	$total_videos_playlist = 0;
	$query_videos = mysqli_query($conexao,"SELECT * FROM playlists_videos where codigo_playlist = '".$dados_playlist["codigo"]."' ORDER by ".$misturar."");
	while ($dados_playlist_video = mysqli_fetch_array($query_videos)) {
		$lista_videos .= $dados_playlist_video["path_video"].",";
		$total_videos_playlist++;
	}
	
	$config_playlist[$playlist]["playlist"] = formatar_nome_playlist($dados_playlist["nome"]);
	$config_playlist[$playlist]["data_inicio"] = date("Y-m-d H:i:s");
	$config_playlist[$playlist]["total_videos"] = $total_videos_playlist;
	$config_playlist[$playlist]["videos"] = substr($lista_videos,0,-1);
	
	$array_config_playlists = array ("login" => $dados_stm["login"], "playlists" => $config_playlist);

} else {

	$config_playlist[$relay]["playlist"] = "relay";
	$config_playlist[$relay]["data_inicio"] = date("Y-m-d H:i:s");
	$config_playlist[$relay]["total_videos"] = 1;
	$config_playlist[$relay]["videos"] = "relay-".md5($dados_agendamento["servidor_relay"]).".stream";
	$config_playlist[$relay]["start"] = "-2";
	
	$array_config_playlists = array ("login" => $dados_stm["login"], "playlists" => $config_playlist);
	
	// Inicia o arquivo de stream do relay no wowza
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, "http://".$dados_servidor["ip"].":555/streammanager/streamAction?action=startStream&vhostName=_defaultVHost_&appName=".$dados_stm["login"]."%2F_definst_&streamName=relay-".md5($dados_agendamento["servidor_relay"]).".stream&groupId=&mediaCasterType=liverepeater");
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt($ch, CURLOPT_TIMEOUT, 5);
	curl_setopt($ch, CURLOPT_USERPWD, "admin:".code_decode($dados_servidor["senha"],"D").""); 
	curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_DIGEST); 
	curl_setopt($ch, CURLOPT_USERAGENT, 'Painel de Streaming 3.0.0');
	curl_exec($ch);
	curl_close($ch);

}
	
$resultado = gerar_playlist($array_config_playlists);

// Gera playlist de finalizacao
if($dados_agendamento["finalizacao"] == "iniciar_playlist") {

$duracao = mysqli_fetch_array(mysqli_query($conexao,"SELECT *,SUM(duracao_segundos) as total FROM playlists_videos where codigo_playlist = '".$dados_playlist["codigo"]."'"));

$duracao_playlist_agendada = $duracao["total"]-2;

// Cria o arquivo da playlist para enviar para servidor
$total_videos_playlist_finalizacao = 0;
$query_videos_finalizacao = mysqli_query($conexao,"SELECT * FROM playlists_videos where codigo_playlist = '".$dados_playlist_finalizacao["codigo"]."' ORDER by ".$misturar."");
while ($dados_playlist_video_finalizacao = mysqli_fetch_array($query_videos_finalizacao)) {
	$lista_videos_finalizacao .= $dados_playlist_video_finalizacao["path_video"].",";
	$total_videos_playlist_finalizacao++;
}
	
$config_playlist_finalizacao[$playlist]["playlist"] = formatar_nome_playlist($dados_playlist_finalizacao["nome"]);
$config_playlist_finalizacao[$playlist]["data_inicio"] = date("Y-m-d H:i:s", strtotime("+".$duracao_playlist_agendada." second"));
$config_playlist_finalizacao[$playlist]["total_videos"] = $total_videos_playlist_finalizacao;
$config_playlist_finalizacao[$playlist]["videos"] = substr($lista_videos_finalizacao,0,-1);
	
$array_config_playlist_finalizacao = array ("login" => $dados_stm["login"], "playlists" => $config_playlist_finalizacao);

gerar_playlist_finalizacao($array_config_playlist_finalizacao);

}

// Envia playlist para servidor
// Conexão FTP
$ftp = new FTP();
$ftp->conectar($dados_servidor["ip"]);
$ftp->autenticar($dados_stm["login"],$dados_stm["senha"]);

$ftp->enviar_arquivo("".str_replace("/robots","",realpath(dirname(__FILE__)))."/temp/".$resultado."","playlists_agendamentos.smil");
@unlink("".str_replace("/robots","",realpath(dirname(__FILE__)))."/temp/".$resultado."");

// Inicia a playlist no Wowza
recarregar_playlists_agendamentos($dados_servidor["ip"],$dados_servidor["senha"],$dados_stm["login"]);

echo "[0x02][".$dados_stm["porta"]."][".date_default_timezone_get()."][".$dados_stm["timezone"]."][".$hora_atual_servidor."][".$hora_inicio."] Iniciando playlist ".$dados_playlist["nome"]." as ".$hora_inicio."\n";

// Atualiza a última playlist tocada
mysqli_query($conexao,"Update streamings set ultima_playlist = '".$dados_playlist["codigo"]."' where codigo = '".$dados_stm["codigo"]."'");

// Loga a ação executada
mysqli_query($conexao,"INSERT INTO playlists_agendamentos_logs (codigo_agendamento,codigo_stm,data,playlist) VALUES ('".$dados_agendamento["codigo"]."','".$dados_stm["codigo"]."',NOW(),'".$dados_playlist["nome"]."')");

} // FIM -> Verifica se esta na hora de iniciar


} else { // Else -> frequencia 3

///////////////////////////////////////////////
/// Frequência 3 -> Executar Dias da Semana ///
///////////////////////////////////////////////

$dia_semana = date("N");
$array_dias = explode(",",substr($dados_agendamento["dias"], 0, -1));

// Verifica se esta na hora de iniciar
if(in_array($dia_semana, $array_dias) === true && $hora_inicio == $hora_atual) { 

if($dados_agendamento["tipo"] == "playlist") {
	
	// Cria o arquivo da playlist para enviar para servidor
	$total_videos_playlist = 0;
	$query_videos = mysqli_query($conexao,"SELECT * FROM playlists_videos where codigo_playlist = '".$dados_playlist["codigo"]."' ORDER by ".$misturar."");
	while ($dados_playlist_video = mysqli_fetch_array($query_videos)) {
		$lista_videos .= $dados_playlist_video["path_video"].",";
		$total_videos_playlist++;
	}
	
	$config_playlist[$playlist]["playlist"] = formatar_nome_playlist($dados_playlist["nome"]);
	$config_playlist[$playlist]["data_inicio"] = date("Y-m-d H:i:s");
	$config_playlist[$playlist]["total_videos"] = $total_videos_playlist;
	$config_playlist[$playlist]["videos"] = substr($lista_videos,0,-1);
	
	$array_config_playlists = array ("login" => $dados_stm["login"], "playlists" => $config_playlist);

} else {

	$config_playlist[$relay]["playlist"] = "relay";
	$config_playlist[$relay]["data_inicio"] = date("Y-m-d H:i:s");
	$config_playlist[$relay]["total_videos"] = 1;
	$config_playlist[$relay]["videos"] = "relay-".md5($dados_agendamento["servidor_relay"]).".stream";
	$config_playlist[$relay]["start"] = "-2";
	
	$array_config_playlists = array ("login" => $dados_stm["login"], "playlists" => $config_playlist);
	
	// Inicia o arquivo de stream do relay no wowza
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, "http://".$dados_servidor["ip"].":555/streammanager/streamAction?action=startStream&vhostName=_defaultVHost_&appName=".$dados_stm["login"]."%2F_definst_&streamName=relay-".md5($dados_agendamento["servidor_relay"]).".stream&groupId=&mediaCasterType=liverepeater");
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt($ch, CURLOPT_TIMEOUT, 5);
	curl_setopt($ch, CURLOPT_USERPWD, "admin:".code_decode($dados_servidor["senha"],"D").""); 
	curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_DIGEST); 
	curl_setopt($ch, CURLOPT_USERAGENT, 'Painel de Streaming 3.0.0');
	curl_exec($ch);
	curl_close($ch);

}
	
$resultado = gerar_playlist($array_config_playlists);

// Gera playlist de finalizacao
if($dados_agendamento["finalizacao"] == "iniciar_playlist") {

$duracao = mysqli_fetch_array(mysqli_query($conexao,"SELECT *,SUM(duracao_segundos) as total FROM playlists_videos where codigo_playlist = '".$dados_playlist["codigo"]."'"));

$duracao_playlist_agendada = $duracao["total"]-2;

// Cria o arquivo da playlist para enviar para servidor
$total_videos_playlist_finalizacao = 0;
$query_videos_finalizacao = mysqli_query($conexao,"SELECT * FROM playlists_videos where codigo_playlist = '".$dados_playlist_finalizacao["codigo"]."' ORDER by ".$misturar."");
while ($dados_playlist_video_finalizacao = mysqli_fetch_array($query_videos_finalizacao)) {
	$lista_videos_finalizacao .= $dados_playlist_video_finalizacao["path_video"].",";
	$total_videos_playlist_finalizacao++;
}
	
$config_playlist_finalizacao[$playlist]["playlist"] = formatar_nome_playlist($dados_playlist_finalizacao["nome"]);
$config_playlist_finalizacao[$playlist]["data_inicio"] = date("Y-m-d H:i:s", strtotime("+".$duracao_playlist_agendada." second"));
$config_playlist_finalizacao[$playlist]["total_videos"] = $total_videos_playlist_finalizacao;
$config_playlist_finalizacao[$playlist]["videos"] = substr($lista_videos_finalizacao,0,-1);
	
$array_config_playlist_finalizacao = array ("login" => $dados_stm["login"], "playlists" => $config_playlist_finalizacao);

gerar_playlist_finalizacao($array_config_playlist_finalizacao);

}

// Envia playlist para servidor
// Conexão FTP
$ftp = new FTP();
$ftp->conectar($dados_servidor["ip"]);
$ftp->autenticar($dados_stm["login"],$dados_stm["senha"]);

$ftp->enviar_arquivo("".str_replace("/robots","",realpath(dirname(__FILE__)))."/temp/".$resultado."","playlists_agendamentos.smil");
@unlink("".str_replace("/robots","",realpath(dirname(__FILE__)))."/temp/".$resultado."");

// Inicia a playlist no Wowza
recarregar_playlists_agendamentos($dados_servidor["ip"],$dados_servidor["senha"],$dados_stm["login"]);

echo "[0x03][".$dados_stm["porta"]."][".date_default_timezone_get()."][".$dados_stm["timezone"]."][".$hora_atual_servidor."][".$hora_inicio."] Iniciando playlist ".$dados_playlist["nome"]." as ".$hora_inicio."\n";

// Atualiza a última playlist tocada
mysqli_query($conexao,"Update streamings set ultima_playlist = '".$dados_playlist["codigo"]."' where codigo = '".$dados_stm["codigo"]."'");

// Loga a ação executada
mysqli_query($conexao,"INSERT INTO playlists_agendamentos_logs (codigo_agendamento,codigo_stm,data,playlist) VALUES ('".$dados_agendamento["codigo"]."','".$dados_stm["codigo"]."',NOW(),'".$dados_playlist["nome"]."')");

} // FIM -> Verifica se o dia da semana é o atual e se esta na hora de iniciar

} // FIM -> frequencia

} // FIM -> Verifica se o servidor esta ON/OFF

} // FIM -> Verifica se o streaming esta ON/OFF

} // FIM -> while

echo "\n[".date("d/m/Y H:i:s")."] Processo Concluído.\n\n";

?>