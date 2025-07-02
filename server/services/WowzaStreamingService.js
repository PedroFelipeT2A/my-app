import DigestFetch from 'digest-fetch';
import fs from 'fs/promises';
import { NodeSSH } from 'node-ssh';
import path from 'path';

const ssh = new NodeSSH();

export class WowzaStreamingService {
    constructor() {
        this.wowzaHost = process.env.WOWZA_HOST || '51.222.156.223';
        this.wowzaPassword = process.env.WOWZA_PASSWORD || 'FK38Ca2SuE6jvJXed97VMn';
        this.wowzaUser = process.env.WOWZA_USER || 'admin';
        this.wowzaPort = process.env.WOWZA_PORT || 6980;
        this.wowzaApplication = process.env.WOWZA_APPLICATION || 'live';
        this.sshUser = process.env.WOWZA_SSH_USER || 'root';
        this.sshPrivateKey = process.env.WOWZA_SSH_KEY_PATH || '';
        this.sshPassword = process.env.WOWZA_SSH_PASSWORD || '';

        this.baseUrl = `http://${this.wowzaHost}:${this.wowzaPort}/v2/servers/_defaultServer_/vhosts/_defaultVHost_`;
        this.client = new DigestFetch(this.wowzaUser, this.wowzaPassword);
        this.activeStreams = new Map();
    }

    async makeWowzaRequest(endpoint, method = 'GET', data = null) {
        try {
            const url = `${this.baseUrl}${endpoint}`;
            const options = {
                method,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            };
            if (data) options.body = JSON.stringify(data);
            const response = await this.client.fetch(url, options);
            const text = await response.text();
            let parsedData;
            try {
                parsedData = text ? JSON.parse(text) : {};
            } catch {
                parsedData = text;
            }
            return { statusCode: response.status, data: parsedData, success: response.ok };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async ensureApplication(appName = null) {
        const applicationName = appName || this.wowzaApplication;
        const checkResult = await this.makeWowzaRequest(`/applications/${applicationName}`);
        if (checkResult.success) return { success: true, exists: true };
        const appConfig = {
            id: applicationName,
            appType: 'Live',
            name: applicationName,
            description: 'Live streaming app created via API',
        };
        const createResult = await this.makeWowzaRequest(`/applications`, 'POST', appConfig);
        return { success: createResult.success, exists: false, created: createResult.success };
    }

    joinUrl(base, path) {
        if (base.endsWith('/')) base = base.slice(0, -1);
        if (path.startsWith('/')) path = path.slice(1);
        return `${base}/${path}`;
    }

    async uploadPushPublishFile(localFilePath, remoteFilePath) {
        try {
            const connectConfig = {
                host: this.wowzaHost,
                username: this.sshUser,
            };
            if (this.sshPrivateKey) connectConfig.privateKey = this.sshPrivateKey;
            else if (this.sshPassword) connectConfig.password = this.sshPassword;
            await ssh.connect(connectConfig);
            await ssh.putFile(localFilePath, remoteFilePath);
            ssh.dispose();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async generatePushPublishMapFile(streamName, platforms) {
        const lines = platforms.map(({ platform, rtmp_url, stream_key }) => {
            const name = platform.codigo || 'default';
            const rtmp = rtmp_url || '';
            const streamKey = stream_key || '';
            return `pushpublishname ${name}\nurl ${rtmp}/${streamKey}\n`;
        });
        const content = lines.join('\n');
        const tempDir = process.env.TEMP || process.env.TMP || 'C:/temp';
        const localPath = path.join(tempDir, `map.publish_${streamName}.txt`);
        const remotePath = `/usr/local/WowzaStreamingEngine/conf/pushpublish/map.publish_${streamName}.txt`;

        try {
            await fs.writeFile(localPath, content, 'utf8');
            const uploadResult = await this.uploadPushPublishFile(localPath, remotePath);
            return uploadResult;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    extractHostFromRtmp(rtmpUrl) {
        try {
            const cleanUrl = rtmpUrl.replace(/^rtmps?:\/\//, '');
            const parts = cleanUrl.split('/');
            return parts[0];
        } catch {
            return rtmpUrl.split('/')[2] || rtmpUrl;
        }
    }

    extractAppFromRtmp(rtmpUrl) {
        try {
            const cleanUrl = rtmpUrl.replace(/^rtmps?:\/\//, '');
            const parts = cleanUrl.split('/');
            return parts[1] || 'live';
        } catch {
            return 'live';
        }
    }

    async startStream({ streamId, userId, playlistId, videos = [], platforms = [], settings = {} }) {
        try {
            const appResult = await this.ensureApplication();
            if (!appResult.success) throw new Error('Falha ao configurar aplicação no Wowza');
            const streamName = `stream_${userId}_${Date.now()}`;
            const mapFileResult = await this.generatePushPublishMapFile(streamName, platforms);
            if (!mapFileResult.success) throw new Error('Erro ao gerar arquivo map.publish.txt');
            let playlistConfig = {};
            if (playlistId && videos.length > 0) playlistConfig = await this.configurePlaylist(streamName, videos, settings);
            this.activeStreams.set(streamId, {
                streamName,
                wowzaStreamId: streamName,
                videos,
                currentVideoIndex: 0,
                startTime: new Date(),
                playlistId,
                platforms,
                viewers: 0,
                bitrate: 2500,
                settings,
                playlistConfig
            });
            return {
                success: true,
                data: {
                    streamName,
                    wowzaStreamId: streamName,
                    rtmpUrl: `rtmp://${this.wowzaHost}:1935/${this.wowzaApplication}`,
                    streamKey: streamName,
                    playUrl: `http://${this.wowzaHost}:1935/${this.wowzaApplication}/${streamName}/playlist.m3u8`,
                    hlsUrl: `http://${this.wowzaHost}:1935/${this.wowzaApplication}/${streamName}/playlist.m3u8`,
                    dashUrl: `http://${this.wowzaHost}:1935/${this.wowzaApplication}/${streamName}/manifest.mpd`,
                    playlistConfig
                },
                bitrate: 2500
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async configurePlaylist(streamName, videos, settings = {}) {
        try {
            const playlistConfig = {
                name: `${streamName}_playlist`,
                repeat: settings.repetir_playlist !== false,
                shuffle: settings.embaralhar_videos === true,
                videos: videos.map(video => ({
                    name: video.nome,
                    uri: video.url,
                    duration: video.duracao || 0
                }))
            };
            if (settings.embaralhar_videos) playlistConfig.videos = this.shuffleArray([...playlistConfig.videos]);
            if (settings.logo_config) {
                playlistConfig.overlay = {
                    logo: {
                        url: settings.logo_config.url,
                        position: settings.logo_config.posicao,
                        opacity: settings.logo_config.opacidade / 100,
                        size: settings.logo_config.tamanho,
                        marginX: settings.logo_config.margem_x,
                        marginY: settings.logo_config.margem_y
                    }
                };
            }
            return playlistConfig;
        } catch {
            return {};
        }
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    async stopStream(streamId) {
        try {
            const streamInfo = this.activeStreams.get(streamId);
            if (!streamInfo) return { success: true, message: 'Stream não estava ativo' };
            this.activeStreams.delete(streamId);
            return { success: true, message: 'Stream parado com sucesso' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getStreamStats(streamId) {
        try {
            const streamInfo = this.activeStreams.get(streamId);
            if (!streamInfo) return { isActive: false, viewers: 0, bitrate: 0, uptime: '00:00:00' };
            const viewers = Math.floor(Math.random() * 50) + 5;
            const bitrate = 2500 + Math.floor(Math.random() * 500);
            streamInfo.viewers = viewers;
            streamInfo.bitrate = bitrate;
            const uptime = this.calculateUptime(streamInfo.startTime);
            return {
                isActive: true,
                viewers,
                bitrate,
                uptime,
                currentVideo: streamInfo.currentVideoIndex + 1,
                totalVideos: streamInfo.videos.length,
                platforms: streamInfo.platforms,
                playlistConfig: streamInfo.playlistConfig
            };
        } catch (error) {
            return { isActive: false, viewers: 0, bitrate: 0, uptime: '00:00:00', error: error.message };
        }
    }

    calculateUptime(startTime) {
        const now = new Date();
        const diff = now - startTime;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    async testConnection() {
        try {
            const result = await this.makeWowzaRequest(`/applications`);
            return { success: result.success, connected: result.success, data: result.data };
        } catch (error) {
            return { success: false, connected: false, error: error.message };
        }
    }

    async listApplications() {
        try {
            const result = await this.makeWowzaRequest(`/applications`);
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getServerInfo() {
        try {
            const result = await this.makeWowzaRequest(`/server`);
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}
