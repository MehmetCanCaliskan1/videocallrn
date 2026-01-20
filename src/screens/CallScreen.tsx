import React, { useEffect, useRef, useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    SafeAreaView, 
    PermissionsAndroid,
    Platform,
    Alert,
    StatusBar
} from 'react-native';
import { 
    createAgoraRtcEngine, 
    ChannelProfileType, 
    RtcSurfaceView,
    ClientRoleType,
    IRtcEngine,
    VideoSourceType,
    RenderModeType,
    DataStreamConfig
} from 'react-native-agora';
import WaitingScreen from './WaitingScreen'; 
const APP_ID = '26bc7e0971794a43bb50854e986ae4fd'; 
const TEMP_TOKEN = ''; 

export default function CallScreen({ route, navigation }: any) {
    const { channelName, isHost } = route.params;

    const agoraEngineRef = useRef<IRtcEngine | null>(null);
    const [joined, setJoined] = useState(false);
    
    const [isApproved, setIsApproved] = useState(isHost ? true : false); // Host ise onaylı başlar
    const [dataStreamId, setDataStreamId] = useState<number | null>(null);

    // Bağlantı Durumları
    const [activeRemoteUid, setActiveRemoteUid] = useState<number | null>(null);
    const [incomingRequestUid, setIncomingRequestUid] = useState<number | null>(null);

    // Medya Kontrolleri
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isCameraFront, setIsCameraFront] = useState(true);

    useEffect(() => {
        init();
        return () => {
            destroy();
        };
    }, []);

    const init = async () => {
        if (Platform.OS === 'android') {
            await requestAndroidPermissions();
        }
        await setupAgora();
    };

    const requestAndroidPermissions = async () => {
        try {
            await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                PermissionsAndroid.PERMISSIONS.CAMERA,
            ]);
        } catch (err) {
            console.warn(err);
        }
    };

    const setupAgora = async () => {
        try {
            const engine = createAgoraRtcEngine();
            agoraEngineRef.current = engine;

            engine.initialize({ appId: APP_ID });

            // Veri Akışı Oluştur
            const config = new DataStreamConfig();
            config.syncWithAudio = false;
            config.ordered = true;
            const streamId = engine.createDataStream(config);
            setDataStreamId(streamId);

            engine.muteAllRemoteAudioStreams(true);
            engine.muteAllRemoteVideoStreams(true);

            
            engine.addListener('onJoinChannelSuccess', (_connection, uid) => {
                console.log('Local kullanıcı kanala girdi:', uid);
                setJoined(true);

    
                if (!isHost) {
                    engine.muteLocalAudioStream(true);
                }
            });

            engine.addListener('onUserJoined', (_connection, uid) => {
                console.log("Remote kullanıcı geldi:", uid);

                if (isHost) {
                    // Host: Gelen kişiyi istemci olarak gör
                    setIncomingRequestUid(uid);
                    
                    engine.muteRemoteVideoStream(uid, false); 
                    engine.muteRemoteAudioStream(uid, true); 
                } else {
                    // Misafir: Host'u gördüğünde
                    setActiveRemoteUid(uid);
                    engine.muteRemoteVideoStream(uid, false);
                    engine.muteRemoteAudioStream(uid, false);
                }
            });

            engine.addListener('onUserOffline', (_connection, uid) => {
                console.log("Kullanıcı çıktı:", uid);

                if (!isHost) {
                    Alert.alert("Görüşme Sona Erdi", "Host yayını sonlandırdı.", [
                        { text: "Tamam", onPress: () => { leave(); } }
                    ]);
                    return; 
                }

                if (activeRemoteUid === uid) setActiveRemoteUid(null);
                if (incomingRequestUid === uid) setIncomingRequestUid(null);
                Alert.alert("Kullanıcı Ayrıldı", "Misafir " + uid + " ayrıldı.");
            });

            // --- YENİ: Onay Mesajını Dinle ---
            engine.addListener('onStreamMessage', (_connection, uid, streamId, data) => {
                const message = String.fromCharCode(...data);
                console.log("Mesaj alındı:", message);

                if (!isHost && message === "APPROVE_GUEST") {
                    Alert.alert("Bağlandı", "Host katılımınızı onayladı.");
                    setIsApproved(true);
                    engine.muteLocalAudioStream(false);
                }
                if (!isHost && message === "REJECT_GUEST") {
                    Alert.alert("Bağlantı Reddedildi", "Host katılımınızı reddetti.");
                    setIsApproved(false);
                    leave();
                }
            });

            engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
            engine.enableVideo();
            engine.startPreview();
            engine.setEnableSpeakerphone(true); 

            engine.joinChannel(TEMP_TOKEN, channelName, 0, {
                clientRoleType: ClientRoleType.ClientRoleBroadcaster
            });

        } catch (e) {
            console.error("Agora Error:", e);
            Alert.alert("Hata", "Görüntülü görüşme başlatılamadı.");
        }
    };

    const destroy = () => {
        try {
            agoraEngineRef.current?.leaveChannel();
            agoraEngineRef.current?.removeAllListeners();
            agoraEngineRef.current?.release();
            console.log("Agora engine destroyed");
        } catch (e) {
            console.error(e);
        }
    };

    const leave = () => {
        destroy();
        navigation.goBack();
    };

    // Host'un Onay/Red Fonksiyonları
    const handleApprove = () => {
        if (incomingRequestUid !== null && agoraEngineRef.current) {
            // 1. Gelen kişinin ses ve videosunu aç
            agoraEngineRef.current.muteRemoteVideoStream(incomingRequestUid, false);
            agoraEngineRef.current.muteRemoteAudioStream(incomingRequestUid, false);
            setActiveRemoteUid(incomingRequestUid);

            // 2. Misafire onay sinyali gönder
            if (dataStreamId !== null) {
                const message = "APPROVE_GUEST";
                const data = new Uint8Array(message.length);
                for (let i = 0; i < message.length; i++) {
                    data[i] = message.charCodeAt(i);
                }
                agoraEngineRef.current.sendStreamMessage(dataStreamId, data, data.length);
            }

            setIncomingRequestUid(null);
        }
    };

   const handleReject = () => {
        setIncomingRequestUid(null);
        if (dataStreamId !== null && agoraEngineRef.current) {
            const message = "REJECT_GUEST";
            const data = new Uint8Array(message.length);
            for (let i = 0; i < message.length; i++) {
                data[i] = message.charCodeAt(i);
            }
            agoraEngineRef.current.sendStreamMessage(dataStreamId, data, data.length);
        }
    };

    const toggleMic = () => {
        if (agoraEngineRef.current) {
            agoraEngineRef.current.muteLocalAudioStream(!isMicMuted);
            setIsMicMuted(!isMicMuted);
        }
    };

    const switchCamera = () => {
        if (agoraEngineRef.current) {
            agoraEngineRef.current.switchCamera();
            setIsCameraFront(!isCameraFront);
        }
    };

    // --- RENDER KISMI ---

    // 1. Misafirsek ve Onaylanmadıysak -> BEKLEME EKRANI
    if (!isHost && !isApproved) {
        return <WaitingScreen onCancel={leave} />;
    }

    // 2. Normal Video Ekranı 
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#111" />
            
            <View style={styles.header}>
                <Text style={styles.channelText}>Oda: {channelName}</Text>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{isHost ? 'HOST' : 'MİSAFİR'}</Text>
                </View>
            </View>

            {/* --- Video Alanı --- */}
            <View style={styles.videoContainer}>
                
                {/* Uzak Kullanıcı Videosu (Full Ekran) */}
                {activeRemoteUid !== null ? (
                    <RtcSurfaceView 
                        canvas={{ uid: activeRemoteUid, renderMode: RenderModeType.RenderModeHidden }} 
                        style={styles.fullScreen} 
                    />
                ) : (
                    // Bağlı kimse yoksa bekleme ekranı
                    <View style={styles.waitingContainer}>
                        <Text style={styles.waitingText}>
                            {isHost ? 'Kullanıcı bekleniyor...' : 'Host bekleniyor...'}
                        </Text>
                        <Text style={styles.waitingSubText}>
                            {joined ? 'Bağlantı kuruldu' : 'Bağlanılıyor...'}
                        </Text>
                    </View>
                )}

                {/* Küçük Ekran */}
                {joined && (
                    <View style={styles.localVideoFloating} >
                        <RtcSurfaceView 
                            canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }} 
                            style={styles.fullScreen} 
                            zOrderMediaOverlay={true} 
                        />
                        <View style={styles.localLabel}>
                            <Text style={styles.localLabelText}>Ben</Text>
                        </View>
                    </View>
                )}

                {/* Popup */}
                {isHost && incomingRequestUid !== null && (
                    <View style={styles.popupOverlay}>
                        <View style={styles.popupBox}>
                            <Text style={styles.popupTitle}>Görüşme İsteği</Text>
                            
                            <View style={styles.popupVideoWrapper}>
                                <RtcSurfaceView
                                    canvas={{ uid: incomingRequestUid, renderMode: 1 }} 
                                    style={styles.popupVideo}
                                    zOrderMediaOverlay={true} 
                                />
                            </View>

                            <Text style={styles.popupDesc}>
                                Bir kullanıcı bağlanmak istiyor.
                            </Text>
                            
                            <View style={styles.popupButtons}>
                                <TouchableOpacity onPress={handleReject} style={[styles.btn, styles.btnReject]}>
                                    <Text style={[styles.btnText, {color: '#d32f2f'}]}>Reddet</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleApprove} style={[styles.btn, styles.btnApprove]}>
                                    <Text style={styles.btnText}>Kabul Et</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </View>

            {/* alt kısmım*/}
            <View style={styles.controls}>
                 <TouchableOpacity onPress={toggleMic} style={[styles.controlBtn, isMicMuted && styles.controlBtnActive]}>
                    <Text style={styles.controlIcon}>{isMicMuted ? '🔇' : '🎤'}</Text>
                </TouchableOpacity> 
                

                <TouchableOpacity onPress={leave} style={styles.endCallBtn}>
                    <Text style={styles.endCallText}>Aramayı Bitir</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={switchCamera} style={styles.controlBtn}>
                    <Text style={styles.controlIcon}></Text>
                </TouchableOpacity>
                
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111' },
    
    // Header
    header: { 
        position: 'absolute', top: 50, left: 0, right: 0, zIndex: 100,
        flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center'
    },
    channelText: { color: 'white', fontSize: 18, fontWeight: 'bold', textShadowColor: 'black', textShadowRadius: 5 },
    badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
    badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },

    // Video Container
    videoContainer: { flex: 1, position: 'relative', backgroundColor: '#222' },
    fullScreen: { flex: 1, width: '100%', height: '100%' },

    // Waiting Screen
    waitingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    waitingText: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    waitingSubText: { color: '#888', fontSize: 14 },

    // Local Video (Küçük Pencere)
    localVideoFloating: {
        position: 'absolute',
        top: 30,
        right: 5,
        width: 120,
        height: 200,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
        zIndex: 50,
        elevation: 10,
        backgroundColor: '#000'
    },
    localLabel: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', padding: 3, borderRadius: 3 },
    localLabelText: { color: 'white', fontSize: 10 },

    // Popup (Modal)
    popupOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 200
    },
    popupBox: {
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        elevation: 20
    },
    popupTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#333' },
    popupDesc: { fontSize: 15, color: '#666', marginBottom: 24, textAlign: 'center' },
    popupButtons: { flexDirection: 'row', width: '100%', gap: 12 },
    btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    btnReject: { backgroundColor: '#FFEDEF' },
    btnApprove: { backgroundColor: '#00C851' },
    btnText: { color: 'white', fontWeight: '600', fontSize: 16 },

    // Alt Kontroller
    controls: { 
        position: 'absolute', bottom: 40, left: 0, right: 0,
        flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', 
        zIndex: 100 
    },
    controlBtn: { 
        width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', 
        justifyContent: 'center', alignItems: 'center' 
    },
    controlBtnActive: { backgroundColor: 'white' },
    controlIcon: { fontSize: 22 },
    endCallBtn: { 
        backgroundColor: '#FF4444', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 30,
        shadowColor: '#FF4444', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5
    },
    endCallText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    
    popupVideoWrapper: {
        width: '100%',
        height: 200,          
        backgroundColor: '#000',
        borderRadius: 12,
        overflow: 'hidden',   
        marginBottom: 15,    
    },
    popupVideo: {
        width: '100%',
        height: '100%',
    },
});