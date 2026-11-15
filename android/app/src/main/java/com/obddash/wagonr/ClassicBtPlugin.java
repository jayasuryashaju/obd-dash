package com.obddash.wagonr;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Classic Bluetooth (RFCOMM / SPP) link for ELM327 adapters that pair with a PIN
 * in Android settings. JS API: listPaired(), connect({address}), write({value}),
 * disconnect(); events: "data" {value}, "disconnected".
 */
@SuppressLint("MissingPermission")
@CapacitorPlugin(
    name = "ClassicBt",
    permissions = { @Permission(alias = "bt", strings = { Manifest.permission.BLUETOOTH_CONNECT }) }
)
public class ClassicBtPlugin extends Plugin {
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothSocket socket;
    private OutputStream out;
    private Thread reader;

    private BluetoothAdapter adapter() {
        BluetoothManager m = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return m == null ? null : m.getAdapter();
    }

    private boolean needsRuntimePermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bt") != PermissionState.GRANTED;
    }

    @PluginMethod
    public void listPaired(PluginCall call) {
        if (needsRuntimePermission()) { requestPermissionForAlias("bt", call, "permCallbackList"); return; }
        doList(call);
    }

    @PermissionCallback
    private void permCallbackList(PluginCall call) {
        if (getPermissionState("bt") == PermissionState.GRANTED) doList(call);
        else call.reject("Bluetooth permission denied");
    }

    private void doList(PluginCall call) {
        BluetoothAdapter a = adapter();
        if (a == null) { call.reject("This phone has no Bluetooth"); return; }
        if (!a.isEnabled()) { call.reject("Bluetooth is off – turn it on and retry"); return; }
        JSArray list = new JSArray();
        for (BluetoothDevice d : a.getBondedDevices()) {
            if (d.getType() == BluetoothDevice.DEVICE_TYPE_LE) continue; // BLE-only → use BLE path
            JSObject o = new JSObject();
            o.put("name", d.getName());
            o.put("address", d.getAddress());
            list.put(o);
        }
        JSObject ret = new JSObject();
        ret.put("devices", list);
        call.resolve(ret);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (needsRuntimePermission()) { requestPermissionForAlias("bt", call, "permCallbackConnect"); return; }
        doConnect(call);
    }

    @PermissionCallback
    private void permCallbackConnect(PluginCall call) {
        if (getPermissionState("bt") == PermissionState.GRANTED) doConnect(call);
        else call.reject("Bluetooth permission denied");
    }

    private void doConnect(PluginCall call) {
        String address = call.getString("address");
        BluetoothAdapter a = adapter();
        if (a == null || address == null) { call.reject("No adapter / address"); return; }
        closeSocket();
        new Thread(() -> {
            BluetoothDevice dev = a.getRemoteDevice(address);
            a.cancelDiscovery();
            BluetoothSocket s = null;
            IOException last = null;
            // Many cheap ELM327 clones only accept one of these three socket styles.
            for (int attempt = 0; attempt < 3 && s == null; attempt++) {
                BluetoothSocket tryS = null;
                try {
                    if (attempt == 0) tryS = dev.createRfcommSocketToServiceRecord(SPP);
                    else if (attempt == 1) tryS = dev.createInsecureRfcommSocketToServiceRecord(SPP);
                    else {
                        Method m = dev.getClass().getMethod("createRfcommSocket", int.class);
                        tryS = (BluetoothSocket) m.invoke(dev, 1);
                    }
                    tryS.connect();
                    s = tryS;
                } catch (Exception e) {
                    last = e instanceof IOException ? (IOException) e : new IOException(e.getMessage());
                    try { if (tryS != null) tryS.close(); } catch (IOException ignored) { }
                }
            }
            if (s == null) {
                call.reject("Could not open Bluetooth link: " + (last != null ? last.getMessage() : "unknown"));
                return;
            }
            try {
                socket = s;
                out = s.getOutputStream();
                startReader(s.getInputStream());
                call.resolve();
            } catch (IOException e) {
                closeSocket();
                call.reject(e.getMessage());
            }
        }).start();
    }

    private void startReader(InputStream in) {
        reader = new Thread(() -> {
            byte[] buf = new byte[1024];
            try {
                while (!Thread.currentThread().isInterrupted()) {
                    int n = in.read(buf);
                    if (n < 0) break;
                    JSObject o = new JSObject();
                    o.put("value", new String(buf, 0, n, StandardCharsets.US_ASCII));
                    notifyListeners("data", o);
                }
            } catch (IOException ignored) { }
            if (socket != null) {
                closeSocket();
                notifyListeners("disconnected", new JSObject());
            }
        });
        reader.start();
    }

    @PluginMethod
    public void write(PluginCall call) {
        String v = call.getString("value", "");
        if (out == null) { call.reject("Not connected"); return; }
        try {
            out.write(v.getBytes(StandardCharsets.US_ASCII));
            out.flush();
            call.resolve();
        } catch (IOException e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeSocket();
        call.resolve();
    }

    private void closeSocket() {
        BluetoothSocket s = socket;
        socket = null;
        out = null;
        if (reader != null) reader.interrupt();
        reader = null;
        try { if (s != null) s.close(); } catch (IOException ignored) { }
    }

    @Override
    protected void handleOnDestroy() {
        closeSocket();
    }
}
