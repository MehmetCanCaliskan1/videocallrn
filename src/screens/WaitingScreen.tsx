import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { RtcSurfaceView, VideoSourceType } from 'react-native-agora';

interface WaitingScreenProps {
    onCancel: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WaitingScreen({ onCancel }: WaitingScreenProps) {
    return (
        <View style={styles.container}>
            <View style={styles.cameraWrapper}>
                <RtcSurfaceView
                    canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
                    style={styles.cameraView}
                    zOrderMediaOverlay={true}
                />

                <View style={styles.cameraLabel}>
                    <Text style={styles.cameraLabelText}>Önizleme</Text>
                </View>

                <View style={styles.overlay}>
                    <ActivityIndicator size="large" color="#007BFF" style={{ marginBottom: 20 }} />
                    <Text style={styles.title}>Host Onayı Bekleniyor...</Text>
                    <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                        <Text style={styles.buttonText}>İptal Et ve Çık</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000', 
    },
    cameraWrapper: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        position: 'relative',
        backgroundColor: '#000',
    },
    cameraView: {
        width: '100%',
        height: '100%',
    },
    cameraLabel: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4
    },
    cameraLabelText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold'
    },
    overlay: {
        position: 'absolute',
        bottom: 50,
        width: '100%',
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 20,
        textAlign: 'center'
    },
    cancelButton: {
        paddingVertical: 12,
        paddingHorizontal: 30,
        backgroundColor: '#FF4444',
        borderRadius: 8,
        alignItems: 'center'
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600'
    }
});
