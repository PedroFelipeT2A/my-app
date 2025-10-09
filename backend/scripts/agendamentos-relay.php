<?php
ini_set("memory_limit", "256M");
ini_set("max_execution_time", 3600);
ini_set("date.timezone","America/Sao_Paulo");

require_once("".str_replace("/robots","",realpath(dirname(__FILE__)))."/admin/inc/conecta.php");
require_once("".str_replace("/robots","",realpath(dirname(__FILE__)))."/admin/inc/funcoes.php");
require_once("".str_replace("/robots","",realpath(dirname(__FILE__)))."/admin/inc/classe.ssh.php");

parse_str($argv[1],$opcoes);

list($inicial,$final) = explode("-",$opcoes["registros"]);

echo "[".date("d/m/Y H:i:s")."] Processo Iniciado.\n";

$hora_atual_servidor = date("H:i");

$query1 = mysqli_query($conexao,"SELECT * FROM relay_agendamentos ORDER by codigo ASC LIMIT ".$inicial.", ".$final."");
while ($dados_agendamento = mysqli_fetch_array($query1)) {

$dados_stm = mysqli_fetch_array(mysqli_query($conexao,"SELECT * FROM streamings where codigo = '".$dados_agendamento["codigo_stm"]."'"));

$hora_inicio = sprintf("%02d",$dados_agendamento["hora"]).":".sprintf("%02d",$dados_agendamento["minuto"]);
$hora_atual = formatar_data("H:i", $hora_atual_servidor, $dados_stm["timezone"]);
$data_atual = date("Y-m-d");

$chave = ($dados_stm["aplicacao"] == 'tvstation') ? "live" : $dados_stm["login"];

if($dados_stm["status"] == 1) {

$dados_servidor = mysqli_fetch_array(mysqli_query($conexao,"SELECT * FROM servidores where codigo = '".$dados_stm["codigo_servidor"]."'"));

if($dados_servidor["status"] == "on") {

//////////////////////////////////////////////////////////////
//// Frequência 1 -> Executar em data específica(uma vez) ////
//////////////////////////////////////////////////////////////

if($dados_agendamento["frequencia"] == 1) {

// Verifica se a data específica é hoje e se esta na hora de iniciar
if($dados_agendamento["data"] == $data_atual && $hora_inicio == $hora_atual) {

// Conexão SSH
$ssh = new SSH();
$ssh->conectar($dados_servidor["ip"],$dados_servidor["porta_ssh"]);
$ssh->autenticar("root",code_decode($dados_servidor["senha"],"D"));

// Finaliza relay atual se existir
$ssh->executar("echo OK;screen -ls | grep -o '[0-9]*.".$dados_stm["login"]."_*' | xargs -I{} screen -X -S {} quit");

// Inicia o relay
$autenticar = ($dados_stm["autenticar_live"] == "sim") ? "".$dados_stm["login"].":".$dados_stm["senha_transmissao"]."@" : "";

$ssh->executar('echo OK;screen -dmS '.$dados_stm["login"].'_'.$dados_agendamento["codigo"].' bash -c \'/usr/local/bin/ffmpeg -re -i \''.$dados_agendamento["servidor_relay"].'\' -c:v copy -c:a copy -bsf:a aac_adtstoasc -preset medium -threads 1 -f flv \'rtmp://'.$autenticar.'localhost:1935/'.$dados_stm["login"].'/'.$chave.'\'; exec sh\'');

echo "[0x01][".$dados_stm["login"]."][".date_default_timezone_get()."][".$dados_stm["timezone"]."][".$hora_atual_servidor."][".$hora_inicio."] Iniciando relay ".$dados_agendamento["servidor_relay	"]." em ".$dados_agendamento["data"]." as ".$hora_inicio."\n";

mysqli_query($conexao,"Update relay_agendamentos set status = '1', log_data_inicio = NOW() where codigo = '".$dados_agendamento["codigo"]."'");

// Loga o agendamento
mysqli_query($conexao,"INSERT INTO relay_agendamentos_logs (codigo_agendamento,codigo_stm,data,servidor_relay) VALUES ('".$dados_agendamento["codigo"]."','".$dados_stm["codigo"]."',NOW(),'<strong>Iniciado</strong> ".$dados_agendamento["servidor_relay"]."')");

// Remove o agendamento
mysqli_query($conexao,"Delete From relay_agendamentos where codigo = '".$dados_agendamento["codigo"]."'");

} // FIM -> Verifica se esta na hora de iniciar / Frequência 1

} elseif($dados_agendamento["frequencia"] == 2) { // Else -> frequencia 2

//////////////////////////////////////////////
//// Frequência 2 -> Executar Diariamente ////
//////////////////////////////////////////////

// Verifica se esta na hora de iniciar
if($hora_inicio == $hora_atual) { 

// Conexão SSH
$ssh = new SSH();
$ssh->conectar($dados_servidor["ip"],$dados_servidor["porta_ssh"]);
$ssh->autenticar("root",code_decode($dados_servidor["senha"],"D"));

// Finaliza relay atual se existir
$ssh->executar("echo OK;screen -ls | grep -o '[0-9]*.".$dados_stm["login"]."_*' | xargs -I{} screen -X -S {} quit");

// Inicia o relay
$autenticar = ($dados_stm["autenticar_live"] == "sim") ? "".$dados_stm["login"].":".$dados_stm["senha_transmissao"]."@" : "";

$ssh->executar('echo OK;screen -dmS '.$dados_stm["login"].'_'.$dados_agendamento["codigo"].' bash -c \'/usr/local/bin/ffmpeg -re -i \''.$dados_agendamento["servidor_relay"].'\' -c:v copy -c:a copy -bsf:a aac_adtstoasc -preset medium -threads 1 -f flv \'rtmp://'.$autenticar.'localhost:1935/'.$dados_stm["login"].'/'.$chave.'\'; exec sh\'');

echo "[0x02][".$dados_stm["login"]."][".date_default_timezone_get()."][".$dados_stm["timezone"]."][".$hora_atual_servidor."][".$hora_inicio."] Iniciando relay ".$dados_agendamento["servidor_relay"]." as ".$hora_inicio."\n";

mysqli_query($conexao,"Update relay_agendamentos set status = '1', log_data_inicio = NOW() where codigo = '".$dados_agendamento["codigo"]."'");

// Loga o agendamento
mysqli_query($conexao,"INSERT INTO relay_agendamentos_logs (codigo_agendamento,codigo_stm,data,servidor_relay) VALUES ('".$dados_agendamento["codigo"]."','".$dados_stm["codigo"]."',NOW(),'<strong>Iniciado</strong> ".$dados_agendamento["servidor_relay"]."')");

} // FIM -> Verifica se esta na hora de iniciar


} else { // Else -> frequencia 3

///////////////////////////////////////////////
/// Frequência 3 -> Executar Dias da Semana ///
///////////////////////////////////////////////

$dia_semana = date("N");
$array_dias = explode(",",substr($dados_agendamento["dias"], 0, -1));

// Verifica se esta na hora de iniciar
if(in_array($dia_semana, $array_dias) === true && $hora_inicio == $hora_atual) { 

// Conexão SSH
$ssh = new SSH();
$ssh->conectar($dados_servidor["ip"],$dados_servidor["porta_ssh"]);
$ssh->autenticar("root",code_decode($dados_servidor["senha"],"D"));

// Finaliza relay atual se existir
$ssh->executar("echo OK;screen -ls | grep -o '[0-9]*.".$dados_stm["login"]."_*' | xargs -I{} screen -X -S {} quit");

// Inicia o relay
$autenticar = ($dados_stm["autenticar_live"] == "sim") ? "".$dados_stm["login"].":".$dados_stm["senha_transmissao"]."@" : "";

$ssh->executar('echo OK;screen -dmS '.$dados_stm["login"].'_'.$dados_agendamento["codigo"].' bash -c \'/usr/local/bin/ffmpeg -re -i \''.$dados_agendamento["servidor_relay"].'\' -c:v copy -c:a copy -bsf:a aac_adtstoasc -preset medium -threads 1 -f flv \'rtmp://'.$autenticar.'localhost:1935/'.$dados_stm["login"].'/'.$chave.'\'; exec sh\'');

echo "[0x03][".$dados_stm["login"]."][".date_default_timezone_get()."][".$dados_stm["timezone"]."][".$hora_atual_servidor."][".$hora_inicio."] Iniciando relay ".$dados_agendamento["servidor_relay"]." as ".$hora_inicio."\n";

mysqli_query($conexao,"Update relay_agendamentos set status = '1', log_data_inicio = NOW() where codigo = '".$dados_agendamento["codigo"]."'");

// Loga o agendamento
mysqli_query($conexao,"INSERT INTO relay_agendamentos_logs (codigo_agendamento,codigo_stm,data,servidor_relay) VALUES ('".$dados_agendamento["codigo"]."','".$dados_stm["codigo"]."',NOW(),'<strong>Iniciado</strong> ".$dados_agendamento["servidor_relay"]."')");

} // FIM -> Verifica se o dia da semana é o atual e se esta na hora de iniciar

} // FIM -> frequencia

} // FIM -> Verifica se o servidor esta ON/OFF

} // FIM -> Verifica se o streaming esta ON/OFF

} // FIM -> while

// FInaliza os agendamentos
$query2 = mysqli_query($conexao,"SELECT * FROM relay_agendamentos WHERE status = '1' AND duracao != '00:00' ORDER by codigo ASC LIMIT ".$inicial.", ".$final."");
while ($dados_agendamento_finalizar = mysqli_fetch_array($query2)) {

$dados_stm = mysqli_fetch_array(mysqli_query($conexao,"SELECT * FROM streamings where codigo = '".$dados_agendamento_finalizar["codigo_stm"]."'"));

date_default_timezone_set($dados_stm["timezone"]);

$duracao = strtotime($dados_agendamento_finalizar["duracao"]) - strtotime('TODAY');

if($dados_stm["status"] == 1) {

$dados_servidor = mysqli_fetch_array(mysqli_query($conexao,"SELECT * FROM servidores where codigo = '".$dados_stm["codigo_servidor"]."'"));

if($dados_servidor["status"] == "on") {

$data_inicio = new DateTime($dados_agendamento_finalizar["log_data_inicio"]);
$data_inicio->modify('+'.$duracao.' seconds'); 
$data_atual = new DateTime('NOW');

if($data_atual >= $data_inicio) {

// Conexão SSH
$ssh = new SSH();
$ssh->conectar($dados_servidor["ip"],$dados_servidor["porta_ssh"]);
$ssh->autenticar("root",code_decode($dados_servidor["senha"],"D"));

// Inicia o relay
$ssh->executar("echo OK;screen -ls | grep -o '[0-9]*.".$dados_stm["login"]."_".$dados_agendamento_finalizar["codigo"]."' | xargs -I{} screen -X -S {} quit");

echo "[0x00][".$dados_stm["login"]."] Relay finalizado ".$dados_agendamento["servidor_relay"]." as ".$data_atual."\n";

mysqli_query($conexao,"Update relay_agendamentos set status = '2' where codigo = '".$dados_agendamento["codigo"]."'");

// Loga o agendamento
mysqli_query($conexao,"INSERT INTO relay_agendamentos_logs (codigo_agendamento,codigo_stm,data,servidor_relay) VALUES ('".$dados_agendamento["codigo"]."','".$dados_stm["codigo"]."',NOW(),'<strong>Finalizado</strong> ".$dados_agendamento["servidor_relay"]."')");

}

} // FIM -> Verifica se o servidor esta ON/OFF

} // FIM -> Verifica se o streaming esta ON/OFF

} // FIM -> while

echo "\n[".date("d/m/Y H:i:s")."] Processo Concluído.\n\n";

?>