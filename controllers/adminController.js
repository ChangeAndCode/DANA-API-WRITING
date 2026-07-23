const userRepository = require('../repositories/userRepository');
const mongoose = require('mongoose');

const VALID_USER_ROLES = ['user', 'admin'];
const VALID_USER_SITES = ['gaiim', 'p1a'];

const normalizeUserSite = (site) => {
  return typeof site === 'string' ? site.trim() : '';
};

const buildAdminUserResponse = (user) => ({
  id: user._id || user.id,
  displayName: user.displayName,
  email: user.email,
  isActive: user.isActive,
  role: user.role,
  site: user.site || '',
  createdAt: user.createdAt,
});

const getAllUsers = async (req, res) => {
  try {
    const users = await userRepository.getAllUsers();

    const usersCleaned = users.map((user) => buildAdminUserResponse(user));

    res.status(200).json(usersCleaned);
  } catch (error) {
    console.error('Error al obtener todos los usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const updateUserAccess = async (req, res) => {
  const { userId } = req.params;
  const { isActive, role, site } = req.body;

  if (typeof isActive !== 'boolean' || !VALID_USER_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Datos de actualización inválidos.' });
  }

  const normalizedSite = normalizeUserSite(site);

  if (role !== 'admin' && !VALID_USER_SITES.includes(normalizedSite)) {
    return res.status(400).json({
      message: 'Debes asignar una sede válida al usuario.',
    });
  }

  if (req.user.id.toString() === userId && !isActive) {
    return res.status(403).json({
      message: 'No puedes deshabilitar tu propia cuenta.',
    });
  }

  if (
    req.user.id.toString() === userId &&
    role === 'user' &&
    req.user.role === 'admin'
  ) {
    // Aquí después se puede endurecer la regla si quieres evitar
    // que el único admin se quite a sí mismo el rol.
  }

  try {
    const updatedUser = await userRepository.updateUserAccess(
      userId,
      isActive,
      role,
      normalizedSite,
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    res.status(200).json({
      message: 'Acceso de usuario actualizado exitosamente.',
      user: buildAdminUserResponse(updatedUser),
    });
  } catch (error) {
    console.error('Error al actualizar acceso de usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const deleteUser = async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'ID de usuario inválido.' });
  }

  if (req.user.id.toString() === userId) {
    return res.status(403).json({ message: 'No puedes eliminar tu propia cuenta.' });
  }

  let session;

  try {
    session = await mongoose.startSession();
    await session.startTransaction();

    const deletedUser = await userRepository.deleteUserById(userId, session);

    if (!deletedUser) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error('Error al abortar transacción (usuario no encontrado):', abortError);
      }
      return res.status(404).json({
        message: 'Usuario no encontrado o ya fue eliminado.',
      });
    }

    const sessionCollection = mongoose.connection.collection('sessions_dana');
    let cursor;

    try {
      cursor = sessionCollection.find(
        {},
        { projection: { _id: 1, session: 1 }, session },
      );

      const sessionIdsToDelete = [];

      while (await cursor.hasNext()) {
        const sess = await cursor.next();
        try {
          const sessionData = JSON.parse(sess.session);
          if (sessionData.passport && sessionData.passport.user === userId) {
            sessionIdsToDelete.push(sess._id);
          }
        } catch (parseError) {
          continue;
        }
      }

      if (sessionIdsToDelete.length > 0) {
        await sessionCollection.deleteMany(
          { _id: { $in: sessionIdsToDelete } },
          { session },
        );
      }
    } catch (sessionError) {
      console.error('Error al invalidar sesiones:', sessionError);
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error('Error al abortar transacción (fallo en sesiones):', abortError);
      }
      return res.status(500).json({
        message: 'Error al invalidar sesiones del usuario.',
      });
    } finally {
      if (cursor) {
        await cursor.close();
      }
    }

    await session.commitTransaction();

    res.status(200).json({
      message:
        'Usuario eliminado exitosamente. Sus trabajos de conversión se mantienen para auditoría.',
    });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error('Error al abortar transacción (error general):', abortError);
      }
    }
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

module.exports = {
  getAllUsers,
  updateUserAccess,
  deleteUser,
};